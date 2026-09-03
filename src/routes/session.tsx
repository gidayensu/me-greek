import { useMemo, useRef, useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  Cancel01Icon,
  RefreshIcon,
  StarIcon,
  Target01Icon,
  TrophyIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { ProgressBar } from "@/components/ui/progress-bar"
import { Card, StatCard } from "@/components/layout/page-parts"
import { GreekText } from "@/components/vocabulary/word-bits"
import { MultipleChoiceCard } from "@/components/session/multiple-choice"
import { FlashcardCard } from "@/components/session/flashcard"
import {
  DIRECTION,
  LEARNING_STATUS,
  MAX_QUESTION_COUNT,
  QUESTION_ORDER,
  QUIZ_MODE,
  SELECTION_MODE,
} from "@/lib/constants"
import type { Direction, QuestionOrder, QuizMode } from "@/lib/constants"
import type {
  AnswerRecord,
  SelectionSpec,
  SessionRecord,
  StatusFilter,
  WordProgress,
} from "@/lib/learning/types"
import { buildSession } from "@/lib/learning/session"
import { progressFor, recordAnswer } from "@/lib/learning/progress"
import { getSet, getWord } from "@/lib/vocabulary/vocabulary"
import { useAppStore } from "@/lib/state/app-store"
import { formatDuration, percent } from "@/lib/format"

type SessionSearch = {
  mode: QuizMode
  direction: Direction
  order: QuestionOrder
  count: number
  /** Carried in the URL so a session survives a page reload. */
  selection: SelectionSpec
  statusFilter: StatusFilter
  seed: number
}

export const Route = createFileRoute("/session")({
  component: SessionPage,
  validateSearch: (search: Record<string, unknown>): SessionSearch => ({
    mode:
      search.mode === QUIZ_MODE.FLASHCARDS
        ? QUIZ_MODE.FLASHCARDS
        : QUIZ_MODE.MULTIPLE_CHOICE,
    direction:
      search.direction === DIRECTION.ENGLISH_TO_GREEK
        ? DIRECTION.ENGLISH_TO_GREEK
        : DIRECTION.GREEK_TO_ENGLISH,
    order:
      search.order === QUESTION_ORDER.RANDOM ||
      search.order === QUESTION_ORDER.SEQUENTIAL
        ? search.order
        : QUESTION_ORDER.ADAPTIVE,
    count: Number(search.count) || 20,
    selection: parseSelection(search.selection),
    statusFilter: parseFilter(search.statusFilter),
    seed: Number(search.seed) || 1,
  }),
})

const FALLBACK_SELECTION: SelectionSpec = {
  mode: SELECTION_MODE.SETS,
  setIds: ["set-1"],
}

/** Search params arrive untrusted — anything unrecognised falls back safely. */
function parseSelection(raw: unknown): SelectionSpec {
  if (!raw || typeof raw !== "object") return FALLBACK_SELECTION
  const value = raw as Partial<SelectionSpec> & Record<string, unknown>
  switch (value.mode) {
    case SELECTION_MODE.SETS:
      return Array.isArray(value.setIds)
        ? { mode: SELECTION_MODE.SETS, setIds: value.setIds.map(String) }
        : FALLBACK_SELECTION
    case SELECTION_MODE.RANGE:
      return {
        mode: SELECTION_MODE.RANGE,
        fromRank: Number(value.fromRank) || 1,
        toRank: Number(value.toRank) || 1,
      }
    case SELECTION_MODE.CUSTOM:
      return Array.isArray(value.wordIds)
        ? { mode: SELECTION_MODE.CUSTOM, wordIds: value.wordIds.map(String) }
        : FALLBACK_SELECTION
    case SELECTION_MODE.DIFFICULT:
      return {
        mode: SELECTION_MODE.DIFFICULT,
        limit: Number(value.limit) || MAX_QUESTION_COUNT,
      }
    default:
      return FALLBACK_SELECTION
  }
}

function parseFilter(raw: unknown): StatusFilter {
  const value = (raw ?? {}) as Partial<StatusFilter>
  return {
    includeNew: value.includeNew !== false,
    includeLearning: value.includeLearning !== false,
    includeMastered: value.includeMastered === true,
  }
}

function describeSelection(selection: SelectionSpec): string {
  switch (selection.mode) {
    case SELECTION_MODE.SETS: {
      const titles = selection.setIds
        .map((id) => getSet(id))
        .filter(Boolean)
        .map((set) => `Set ${set!.index}`)
      return titles.length > 0 ? titles.join(", ") : "Selected sets"
    }
    case SELECTION_MODE.RANGE:
      return `Ranks ${selection.fromRank}–${selection.toRank}`
    case SELECTION_MODE.CUSTOM:
      return "Custom list"
    case SELECTION_MODE.DIFFICULT:
      return "Difficult words"
  }
}

function SessionPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const { data, saveSession } = useAppStore()

  const selection = search.selection
  const sourceLabel = useMemo(() => describeSelection(selection), [selection])

  /**
   * The session is built once, from a seed carried in the URL. Rebuilding on
   * every render would reshuffle the questions as progress changes underneath.
   */
  const built = useRef<ReturnType<typeof buildSession> | null>(null)
  if (built.current === null) {
    built.current = buildSession(
      {
        selection,
        statusFilter: search.statusFilter,
        mode: search.mode,
        direction: search.direction,
        questionOrder: search.order,
        questionCount: search.count,
      },
      data,
      search.seed
    )
  }
  const questions = built.current.questions

  const startedAt = useRef(Date.now())
  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [answers, setAnswers] = useState<AnswerRecord[]>([])
  const [finished, setFinished] = useState<SessionRecord | null>(null)

  if (questions.length === 0) {
    return <EmptyState onBack={() => void navigate({ to: "/practice" })} />
  }

  if (finished) {
    return <Results session={finished} />
  }

  const question = questions[index]

  /** Records one answer and moves on, finishing the session on the last card. */
  function submitAnswer(correct: boolean, answered?: string) {
    const record: AnswerRecord = {
      wordId: question.word.id,
      correct,
      answered,
      answeredAt: Date.now(),
    }
    const nextAnswers = [...answers, record]
    setAnswers(nextAnswers)

    if (index + 1 < questions.length) {
      setIndex(index + 1)
      setChosen(null)
      setRevealed(false)
      setFlipped(false)
      return
    }
    complete(nextAnswers)
  }

  /**
   * Applies every answer to the learner's progress, then persists locally and
   * hands the result to the sync layer. Progress is derived here rather than
   * incrementally, so a mid-session reload cannot leave half-counted words.
   */
  function complete(allAnswers: AnswerRecord[]) {
    const updated: Record<string, WordProgress> = {}
    const newlyMastered: string[] = []

    for (const answer of allAnswers) {
      const before = updated[answer.wordId] ?? progressFor(data, answer.wordId)
      const after = recordAnswer(before, answer.correct, answer.answeredAt)
      updated[answer.wordId] = after
      if (
        after.status === LEARNING_STATUS.MASTERED &&
        before.status !== LEARNING_STATUS.MASTERED
      ) {
        newlyMastered.push(answer.wordId)
      }
    }

    const record: SessionRecord = {
      id: crypto.randomUUID(),
      mode: search.mode,
      direction: search.direction,
      startedAt: startedAt.current,
      endedAt: Date.now(),
      wordIds: questions.map((q) => q.word.id),
      answers: allAnswers,
      newlyMastered,
      sourceLabel,
    }

    saveSession(record, updated)
    setFinished(record)
  }

  const progressValue = (index / questions.length) * 100

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <header className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-xs text-muted-foreground">
              {sourceLabel}
            </p>
            <p className="shrink-0 text-xs font-medium tabular-nums">
              {index + 1} / {questions.length}
            </p>
          </div>
          <ProgressBar
            className="mt-1.5"
            value={progressValue}
            label="Session progress"
          />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Exit session"
          onClick={() => void navigate({ to: "/practice" })}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={17} />
        </Button>
      </header>

      <div className="mt-8">
        {search.mode === QUIZ_MODE.MULTIPLE_CHOICE ? (
          <MultipleChoiceCard
            key={question.word.id}
            question={question}
            chosen={chosen}
            revealed={revealed}
            showTransliteration={data.settings.showTransliteration}
            onChoose={setChosen}
            onSubmit={() => {
              if (!data.settings.immediateFeedback) {
                submitAnswer(chosen === question.answer, chosen ?? undefined)
                return
              }
              setRevealed(true)
            }}
            onSkip={() => submitAnswer(false)}
            onContinue={() =>
              submitAnswer(chosen === question.answer, chosen ?? undefined)
            }
          />
        ) : (
          <FlashcardCard
            key={question.word.id}
            question={question}
            flipped={flipped}
            showTransliteration={data.settings.showTransliteration}
            onFlip={() => setFlipped((value) => !value)}
            onRespond={(knewIt) => submitAnswer(knewIt)}
          />
        )}
      </div>
    </div>
  )
}

function EmptyState({ onBack }: { onBack: () => void }) {
  return (
    <div className="mx-auto max-w-md p-8 pt-20 text-center">
      <h1 className="font-heading text-xl font-semibold">
        Nothing to practise
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        No words matched this selection. Try widening the status filter or
        choosing more sets.
      </p>
      <Button className="mt-4" onClick={onBack}>
        Back to setup
      </Button>
    </div>
  )
}

function Results({ session }: { session: SessionRecord }) {
  const { toggleDifficult } = useAppStore()
  const correct = session.answers.filter((a) => a.correct).length
  const total = session.answers.length
  const accuracy = total === 0 ? 0 : correct / total
  const missed = session.answers.filter((a) => !a.correct)

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            Session results
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {session.sourceLabel}
          </p>
        </div>
        <img
          src="/images/trophy.png"
          alt=""
          aria-hidden="true"
          className="hidden h-20 w-auto md:block"
        />
      </header>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={Target01Icon}
          tone="text-primary"
          value={percent(accuracy)}
          label="Accuracy"
          detail={`${correct} of ${total} correct`}
        />
        <StatCard
          icon={StarIcon}
          tone="text-warning"
          value={String(session.newlyMastered.length)}
          label="Newly mastered"
          detail="words you can now recall"
        />
        <StatCard
          icon={TrophyIcon}
          tone="text-success"
          value={formatDuration(session.endedAt - session.startedAt)}
          label="Time"
          detail="this session"
        />
      </div>

      {session.newlyMastered.length > 0 ? (
        <Card className="mt-4">
          <h2 className="text-sm font-medium">Newly mastered</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {session.newlyMastered.map((wordId) => (
              <li key={wordId} className="rounded-lg bg-success/15 px-2.5 py-1">
                <WordChip wordId={wordId} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {missed.length > 0 ? (
        <Card className="mt-4">
          <h2 className="text-sm font-medium">Review what you missed</h2>
          <ul className="mt-3 flex flex-col divide-y">
            {missed.map((answer, i) => (
              <MissedRow
                key={`${answer.wordId}-${i}`}
                answer={answer}
                onMarkDifficult={() => toggleDifficult(answer.wordId)}
              />
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="mt-4">
          <p className="text-sm font-medium text-success">
            Every answer correct. Nothing to review.
          </p>
        </Card>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button render={<Link to="/practice" />}>
          <HugeiconsIcon icon={RefreshIcon} size={16} />
          Practise again
        </Button>
        {missed.length > 0 ? (
          <Button
            variant="outline"
            render={<Link to="/practice" search={{ difficult: true }} />}
          >
            Practise missed words
          </Button>
        ) : null}
        <Button variant="ghost" render={<Link to="/" />}>
          Back to home
        </Button>
      </div>
    </div>
  )
}

function WordChip({ wordId }: { wordId: string }) {
  const word = getWord(wordId)
  if (!word) return <span className="text-sm">{wordId}</span>
  return (
    <span className="flex items-baseline gap-2">
      <GreekText className="text-base">{word.greek}</GreekText>
      <span className="text-xs text-muted-foreground">{word.gloss[0]}</span>
    </span>
  )
}

function MissedRow({
  answer,
  onMarkDifficult,
}: {
  answer: AnswerRecord
  onMarkDifficult: () => void
}) {
  const word = getWord(answer.wordId)
  if (!word) return null
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <GreekText className="text-lg">{word.greek}</GreekText>
        <span className="ml-2 text-xs text-muted-foreground">
          {word.transliteration}
        </span>
      </div>
      <div className="flex items-baseline gap-4 text-xs">
        {answer.answered ? (
          <span className="text-destructive">you said “{answer.answered}”</span>
        ) : (
          <span className="text-muted-foreground">skipped</span>
        )}
        <span className="font-medium text-success">
          {word.gloss.join(", ")}
        </span>
        <Button variant="ghost" size="xs" onClick={onMarkDifficult}>
          Flag
        </Button>
      </div>
    </li>
  )
}
