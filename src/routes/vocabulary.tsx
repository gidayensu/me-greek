import { useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  Bookmark02Icon,
  Search01Icon,
  Volume01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { Card, PageHeader } from "@/components/layout/page-parts"
import {
  ExampleQuote,
  GreekText,
  StatusPill,
  WordMeta,
} from "@/components/vocabulary/word-bits"
import { PART_OF_SPEECH_LABEL } from "@/lib/constants"
import type { PartOfSpeech, Word } from "@/lib/vocabulary/types"
import {
  SETS,
  TOTAL_WORDS,
  VOCABULARY_SOURCE,
  filterWords,
  setForRank,
} from "@/lib/vocabulary/vocabulary"
import { accuracyOf, progressFor, statusOf } from "@/lib/learning/progress"
import { useAppStore } from "@/lib/state/app-store"
import { percent } from "@/lib/format"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/vocabulary")({
  component: VocabularyPage,
})

const PAGE_SIZE = 25
const ALL = "all"

function VocabularyPage() {
  const { data, toggleDifficult } = useAppStore()
  const [search, setSearch] = useState("")
  const [setId, setSetId] = useState<string>(ALL)
  const [pos, setPos] = useState<string>(ALL)
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const results = useMemo(
    () =>
      filterWords({
        search,
        setIds: setId === ALL ? undefined : [setId],
        partsOfSpeech: pos === ALL ? undefined : [pos as PartOfSpeech],
      }),
    [search, setId, pos]
  )

  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const visible = results.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE
  )
  const selected: Word | undefined =
    results.find((w) => w.id === selectedId) ?? visible[0]

  function resetPaging<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value)
      setPage(0)
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <PageHeader
        title="Vocabulary library"
        description={`${TOTAL_WORDS} words, ordered by how often they appear in the New Testament.`}
        illustration="/images/books_2.png"
      />

      <Card className="mt-5">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-56 flex-1">
            <HugeiconsIcon
              icon={Search01Icon}
              size={16}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => resetPaging(setSearch)(event.target.value)}
              placeholder="Search Greek, transliteration or English…"
              aria-label="Search vocabulary"
              className="h-9 w-full rounded-md bg-muted pl-8 text-sm"
            />
          </div>
          <Select
            label="Set"
            value={setId}
            onChange={resetPaging(setSetId)}
            options={[
              { value: ALL, label: "All sets" },
              ...SETS.map((set) => ({
                value: set.id,
                label: `Set ${set.index} · ${set.title}`,
              })),
            ]}
          />
          <Select
            label="Part of speech"
            value={pos}
            onChange={resetPaging(setPos)}
            options={[
              { value: ALL, label: "All parts of speech" },
              ...Object.entries(PART_OF_SPEECH_LABEL).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {results.length} word{results.length === 1 ? "" : "s"} match
        </p>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="p-0">
          {visible.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No words match those filters.
            </p>
          ) : (
            <ul className="divide-y">
              {visible.map((word) => (
                <li key={word.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(word.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors",
                      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- `visible[0]` is undefined when the page is empty
                      selected?.id === word.id
                        ? "bg-primary/5"
                        : "hover:bg-muted"
                    )}
                  >
                    <span className="w-9 shrink-0 text-xs text-muted-foreground tabular-nums">
                      {word.rank}
                    </span>
                    <span className="min-w-0 flex-1">
                      <GreekText className="text-lg">{word.greek}</GreekText>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {word.transliteration}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {word.gloss.join(", ")}
                      </span>
                    </span>
                    <StatusPill
                      status={statusOf(data, word.id)}
                      className="shrink-0"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {pageCount > 1 ? (
            <div className="flex items-center justify-between gap-3 bg-muted/40 px-3.5 py-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                Page {safePage + 1} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={safePage >= pageCount - 1}
              >
                Next
              </Button>
            </div>
          ) : null}
        </Card>

        {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- see above */}
        {selected ? (
          <WordDetail
            word={selected}
            onToggleDifficult={() => toggleDifficult(selected.id)}
          />
        ) : null}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        {VOCABULARY_SOURCE}
      </p>
    </div>
  )
}

function WordDetail({
  word,
  onToggleDifficult,
}: {
  word: Word
  onToggleDifficult: () => void
}) {
  const { data } = useAppStore()
  const progress = progressFor(data, word.id)
  const attempts = progress.correct + progress.incorrect
  const set = setForRank(word.rank)

  function speak() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    const utterance = new SpeechSynthesisUtterance(word.greek)
    // Modern Greek is the closest voice most systems ship; it is an aid to
    // recall, not a claim about Koine pronunciation.
    utterance.lang = "el-GR"
    window.speechSynthesis.speak(utterance)
  }

  return (
    <Card className="h-fit">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <GreekText className="text-3xl leading-tight">{word.greek}</GreekText>
          <p className="mt-1 text-sm text-primary">{word.transliteration}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Hear pronunciation"
            onClick={speak}
          >
            <HugeiconsIcon icon={Volume01Icon} size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={
              progress.markedDifficult
                ? "Remove difficult flag"
                : "Flag as difficult"
            }
            aria-pressed={Boolean(progress.markedDifficult)}
            onClick={onToggleDifficult}
          >
            <HugeiconsIcon
              icon={Bookmark02Icon}
              size={16}
              className={progress.markedDifficult ? "text-warning" : undefined}
            />
          </Button>
        </div>
      </div>

      <p className="mt-3 text-lg">{word.gloss.join(", ")}</p>
      <div className="mt-2">
        <WordMeta word={word} />
      </div>
      {set ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Set {set.index} · {set.title}
        </p>
      ) : null}

      <div className="mt-3">
        <StatusPill status={statusOf(data, word.id)} />
      </div>

      {word.note ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {word.note}
        </p>
      ) : null}

      {word.example ? (
        <div className="mt-4">
          <ExampleQuote word={word} />
        </div>
      ) : null}

      <dl className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3 text-center">
        <Stat label="Seen" value={String(progress.seen)} />
        <Stat label="Correct" value={String(progress.correct)} />
        <Stat
          label="Accuracy"
          value={attempts === 0 ? "—" : percent(accuracyOf(progress))}
        />
      </dl>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 rounded-md bg-muted px-2 text-sm"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
