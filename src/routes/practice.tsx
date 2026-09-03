import { useMemo, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  FlashIcon,
  Mortarboard02Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Card, PageHeader } from "@/components/layout/page-parts"
import { GreekText } from "@/components/vocabulary/word-bits"
import {
  DIRECTION,
  MAX_QUESTION_COUNT,
  MIN_QUESTION_COUNT,
  QUESTION_ORDER,
  QUIZ_MODE,
  SELECTION_MODE,
} from "@/lib/constants"
import type {
  Direction,
  QuestionOrder,
  QuizMode,
  SelectionMode,
} from "@/lib/constants"
import type { SelectionSpec, StatusFilter } from "@/lib/learning/types"
import { buildSession } from "@/lib/learning/session"
import { allSetProgress } from "@/lib/learning/insights"
import { difficultWords } from "@/lib/learning/progress"
import { MAX_RANK, primaryGloss, wordsInSet } from "@/lib/vocabulary/vocabulary"
import { useAppStore } from "@/lib/state/app-store"
import { cn } from "@/lib/utils"
import { percent } from "@/lib/format"

type PracticeSearch = { setId?: string; difficult?: boolean }

export const Route = createFileRoute("/practice")({
  component: PracticePage,
  // Only echo back keys that were actually supplied, so a bare /practice is
  // not rewritten to /practice?difficult=false.
  validateSearch: (search: Record<string, unknown>): PracticeSearch => {
    const result: PracticeSearch = {}
    if (typeof search.setId === "string") result.setId = search.setId
    if (search.difficult === true || search.difficult === "true") {
      result.difficult = true
    }
    return result
  },
})

const STEPS = ["Select vocabulary", "Choose format", "Configure"] as const

function PracticePage() {
  const { setId, difficult } = Route.useSearch()
  const navigate = useNavigate()
  const { data } = useAppStore()

  const [step, setStep] = useState(0)
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(
    difficult ? SELECTION_MODE.DIFFICULT : SELECTION_MODE.SETS
  )
  const [selectedSets, setSelectedSets] = useState<string[]>(
    setId ? [setId] : []
  )
  const [range, setRange] = useState({ from: 1, to: 40 })
  const [statusFilter, setStatusFilter] = useState<StatusFilter>({
    includeNew: true,
    includeLearning: true,
    includeMastered: false,
  })
  const [mode, setMode] = useState<QuizMode>(QUIZ_MODE.MULTIPLE_CHOICE)
  const [direction, setDirection] = useState<Direction>(data.settings.direction)
  const [order, setOrder] = useState<QuestionOrder>(data.settings.questionOrder)
  const [count, setCount] = useState(data.settings.questionCount)

  const sets = useMemo(() => allSetProgress(data), [data])
  const difficultCount = useMemo(() => difficultWords(data).length, [data])

  const selection = useMemo<SelectionSpec>(() => {
    if (selectionMode === SELECTION_MODE.DIFFICULT) {
      return { mode: SELECTION_MODE.DIFFICULT, limit: MAX_QUESTION_COUNT }
    }
    if (selectionMode === SELECTION_MODE.RANGE) {
      return {
        mode: SELECTION_MODE.RANGE,
        fromRank: range.from,
        toRank: range.to,
      }
    }
    return { mode: SELECTION_MODE.SETS, setIds: selectedSets }
  }, [selectionMode, selectedSets, range])

  // The preview is the real builder, so the summary can never disagree with
  // what the session actually contains.
  const preview = useMemo(
    () =>
      buildSession(
        {
          selection,
          statusFilter,
          mode,
          direction,
          questionOrder: order,
          questionCount: count,
        },
        data,
        1
      ),
    [selection, statusFilter, mode, direction, order, count, data]
  )

  const canContinue = step > 0 || preview.poolSize > 0
  const ready = preview.questions.length > 0

  function start() {
    void navigate({
      to: "/session",
      search: {
        mode,
        direction,
        order,
        count,
        selection,
        statusFilter,
        seed: Date.now(),
      },
    })
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <PageHeader
        title={STEPS[step]}
        description={`Step ${step + 1} of ${STEPS.length}`}
        illustration="/images/books.png"
      />

      <ol className="mt-5 flex gap-2" aria-label="Practice setup progress">
        {STEPS.map((label, index) => (
          <li key={label} className="flex-1">
            <div
              className={cn(
                "h-1 rounded-full transition-colors",
                index <= step ? "bg-primary" : "bg-muted"
              )}
            />
            <span className="sr-only">
              {label}
              {index === step ? " (current)" : ""}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-5">
        {step === 0 ? (
          <SelectStep
            selectionMode={selectionMode}
            onSelectionModeChange={setSelectionMode}
            sets={sets}
            selectedSets={selectedSets}
            onToggleSet={(id) =>
              setSelectedSets((current) =>
                current.includes(id)
                  ? current.filter((s) => s !== id)
                  : [...current, id]
              )
            }
            range={range}
            onRangeChange={setRange}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            difficultCount={difficultCount}
            poolSize={preview.poolSize}
          />
        ) : null}

        {step === 1 ? <FormatStep mode={mode} onModeChange={setMode} /> : null}

        {step === 2 ? (
          <ConfigureStep
            direction={direction}
            onDirectionChange={setDirection}
            order={order}
            onOrderChange={setOrder}
            count={count}
            onCountChange={setCount}
            mode={mode}
            preview={preview}
          />
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
            Continue
            <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
          </Button>
        ) : (
          <Button onClick={start} disabled={!ready}>
            <HugeiconsIcon icon={SparklesIcon} size={16} />
            Start practice
          </Button>
        )}
      </div>

      {!ready && step === STEPS.length - 1 ? (
        <p className="mt-3 text-sm text-destructive">
          No words match this selection. Widen the status filter or choose more
          sets.
        </p>
      ) : null}
    </div>
  )
}

function SelectStep({
  selectionMode,
  onSelectionModeChange,
  sets,
  selectedSets,
  onToggleSet,
  range,
  onRangeChange,
  statusFilter,
  onStatusFilterChange,
  difficultCount,
  poolSize,
}: {
  selectionMode: SelectionMode
  onSelectionModeChange: (mode: SelectionMode) => void
  sets: ReturnType<typeof allSetProgress>
  selectedSets: string[]
  onToggleSet: (id: string) => void
  range: { from: number; to: number }
  onRangeChange: (range: { from: number; to: number }) => void
  statusFilter: StatusFilter
  onStatusFilterChange: (filter: StatusFilter) => void
  difficultCount: number
  poolSize: number
}) {
  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label="How to choose words"
        value={selectionMode}
        onValueChange={(value) => onSelectionModeChange(value as SelectionMode)}
        options={[
          { value: SELECTION_MODE.SETS, label: "Sets" },
          { value: SELECTION_MODE.RANGE, label: "Range" },
          { value: SELECTION_MODE.DIFFICULT, label: "Difficult" },
        ]}
      />

      {selectionMode === SELECTION_MODE.SETS ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((entry) => {
            const checked = selectedSets.includes(entry.set.id)
            const sample = wordsInSet(entry.set.id).slice(0, 4)
            return (
              <button
                key={entry.set.id}
                type="button"
                onClick={() => onToggleSet(entry.set.id)}
                aria-pressed={checked}
                className={cn(
                  "rounded-xl p-3 text-left shadow-sm transition-colors",
                  checked
                    ? "bg-primary/12 text-primary"
                    : "bg-card hover:bg-muted"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    Set {entry.set.index}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {percent(entry.mastery)} mastered
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {entry.set.title}
                </p>
                <p className="mt-2 truncate text-sm">
                  <GreekText>{sample.map((w) => w.greek).join(", ")}</GreekText>
                  <span className="text-muted-foreground">, …</span>
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {entry.counts.total} words · ranks {entry.set.fromRank}–
                  {entry.set.toRank}
                </p>
              </button>
            )
          })}
        </div>
      ) : null}

      {selectionMode === SELECTION_MODE.RANGE ? (
        <Card className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="From rank"
            value={range.from}
            min={1}
            max={MAX_RANK}
            onChange={(from) => onRangeChange({ ...range, from })}
          />
          <NumberField
            label="To rank"
            value={range.to}
            min={1}
            max={MAX_RANK}
            onChange={(to) => onRangeChange({ ...range, to })}
          />
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Rank 1 is the most frequent word in the New Testament. The database
            holds {MAX_RANK} words.
          </p>
        </Card>
      ) : null}

      {selectionMode === SELECTION_MODE.DIFFICULT ? (
        <Card>
          <h2 className="text-sm font-medium">Words you keep missing</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {difficultCount === 0
              ? "Nothing yet. Words you answer wrong more than half the time, or flag yourself, collect here."
              : `${difficultCount} word${difficultCount === 1 ? "" : "s"} need more practice.`}
          </p>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-sm font-medium">Include words that are…</h2>
        <div className="mt-3 flex flex-wrap gap-4">
          <Checkbox
            label="New"
            checked={statusFilter.includeNew}
            onChange={(includeNew) =>
              onStatusFilterChange({ ...statusFilter, includeNew })
            }
          />
          <Checkbox
            label="Being learned"
            checked={statusFilter.includeLearning}
            onChange={(includeLearning) =>
              onStatusFilterChange({ ...statusFilter, includeLearning })
            }
          />
          <Checkbox
            label="Already mastered"
            checked={statusFilter.includeMastered}
            onChange={(includeMastered) =>
              onStatusFilterChange({ ...statusFilter, includeMastered })
            }
          />
        </div>
        <p
          className={cn(
            "mt-3 text-sm",
            poolSize === 0 ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {poolSize} word{poolSize === 1 ? "" : "s"} selected
        </p>
      </Card>
    </div>
  )
}

const FORMATS = [
  {
    mode: QUIZ_MODE.MULTIPLE_CHOICE,
    icon: Mortarboard02Icon,
    title: "Multiple choice",
    description: "Choose the correct meaning from four options.",
    image: "/images/practice.png",
  },
  {
    mode: QUIZ_MODE.FLASHCARDS,
    icon: FlashIcon,
    title: "Flashcards",
    description: "Reveal each meaning and judge your own recall.",
    image: "/images/flash_cards.png",
  },
] as const

function FormatStep({
  mode,
  onModeChange,
}: {
  mode: QuizMode
  onModeChange: (mode: QuizMode) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {FORMATS.map((format) => (
        <button
          key={format.mode}
          type="button"
          onClick={() => onModeChange(format.mode)}
          aria-pressed={mode === format.mode}
          className={cn(
            "flex flex-col items-start rounded-xl p-4 text-left shadow-sm transition-colors",
            mode === format.mode
              ? "bg-primary/12 text-primary"
              : "bg-card hover:bg-muted"
          )}
        >
          <img
            src={format.image}
            alt=""
            aria-hidden="true"
            className="h-24 w-auto"
          />
          <h2 className="mt-3 flex items-center gap-2 text-base font-medium">
            <HugeiconsIcon
              icon={format.icon}
              size={17}
              className="text-primary"
            />
            {format.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {format.description}
          </p>
        </button>
      ))}
    </div>
  )
}

function ConfigureStep({
  direction,
  onDirectionChange,
  order,
  onOrderChange,
  count,
  onCountChange,
  mode,
  preview,
}: {
  direction: Direction
  onDirectionChange: (direction: Direction) => void
  order: QuestionOrder
  onOrderChange: (order: QuestionOrder) => void
  count: number
  onCountChange: (count: number) => void
  mode: QuizMode
  preview: ReturnType<typeof buildSession>
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <Card>
          <h2 className="text-sm font-medium">Direction</h2>
          <SegmentedControl
            className="mt-3"
            label="Question direction"
            value={direction}
            onValueChange={(value) => onDirectionChange(value as Direction)}
            options={[
              { value: DIRECTION.GREEK_TO_ENGLISH, label: "Greek → English" },
              { value: DIRECTION.ENGLISH_TO_GREEK, label: "English → Greek" },
            ]}
          />
        </Card>

        <Card>
          <h2 className="text-sm font-medium">Question order</h2>
          <SegmentedControl
            className="mt-3"
            label="Question order"
            value={order}
            onValueChange={(value) => onOrderChange(value as QuestionOrder)}
            options={[
              { value: QUESTION_ORDER.ADAPTIVE, label: "Adaptive" },
              { value: QUESTION_ORDER.RANDOM, label: "Random" },
              { value: QUESTION_ORDER.SEQUENTIAL, label: "By frequency" },
            ]}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {order === QUESTION_ORDER.ADAPTIVE
              ? "Words you struggle with come first; mastered words come last."
              : order === QUESTION_ORDER.RANDOM
                ? "Shuffled each time."
                : "Most frequent words first."}
          </p>
        </Card>

        <Card>
          <NumberField
            label="Number of questions"
            value={count}
            min={MIN_QUESTION_COUNT}
            max={MAX_QUESTION_COUNT}
            step={5}
            onChange={onCountChange}
          />
        </Card>
      </div>

      <Card className="h-fit">
        <h2 className="font-heading text-base font-semibold">
          Practice summary
        </h2>
        <dl className="mt-3 flex flex-col gap-2 text-sm">
          <SummaryRow label="Format">
            {mode === QUIZ_MODE.MULTIPLE_CHOICE
              ? "Multiple choice"
              : "Flashcards"}
          </SummaryRow>
          <SummaryRow label="Direction">
            {direction === DIRECTION.GREEK_TO_ENGLISH
              ? "Greek → English"
              : "English → Greek"}
          </SummaryRow>
          <SummaryRow label="Words available">{preview.poolSize}</SummaryRow>
          <SummaryRow label="Questions">{preview.questions.length}</SummaryRow>
        </dl>

        {preview.questions.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground">Starting with</p>
            <p className="mt-1">
              <GreekText className="text-lg">
                {preview.words[0].greek}
              </GreekText>
              <span className="ml-2 text-sm text-muted-foreground">
                {primaryGloss(preview.words[0])}
              </span>
            </p>
          </div>
        ) : null}
      </Card>
    </div>
  )
}

function SummaryRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next))
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-2 flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(clamp(value - step))}
          disabled={value <= min}
        >
          −
        </Button>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          aria-label={label}
          onChange={(event) =>
            onChange(clamp(Number(event.target.value) || min))
          }
          className="h-9 w-20 rounded-md bg-muted px-2 text-center text-sm tabular-nums"
        />
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(clamp(value + step))}
          disabled={value >= max}
        >
          +
        </Button>
      </div>
    </div>
  )
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-primary"
      />
      {label}
    </label>
  )
}
