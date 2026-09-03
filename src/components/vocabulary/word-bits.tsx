import { LEARNING_STATUS } from "@/lib/constants"
import type { LearningStatus } from "@/lib/constants"
import type { Word } from "@/lib/vocabulary/types"
import { cn } from "@/lib/utils"

/**
 * Greek gets the visual weight; transliteration and glosses stay secondary.
 * `.font-greek` guarantees a face with real polytonic coverage.
 */
export function GreekText({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span lang="grc" className={cn("font-greek", className)}>
      {children}
    </span>
  )
}

const STATUS_STYLE: Record<
  LearningStatus,
  { label: string; className: string }
> = {
  [LEARNING_STATUS.MASTERED]: {
    label: "Mastered",
    className: "bg-success/15 text-success",
  },
  [LEARNING_STATUS.LEARNING]: {
    label: "Learning",
    className: "bg-warning/20 text-warning-foreground",
  },
  [LEARNING_STATUS.NEW]: {
    label: "New",
    className: "bg-muted text-muted-foreground",
  },
}

export function StatusPill({
  status,
  className,
}: {
  status: LearningStatus
  className?: string
}) {
  const style = STATUS_STYLE[status]
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        style.className,
        className
      )}
    >
      {style.label}
    </span>
  )
}

/** Grammatical detail line: part of speech, gender, rank. */
export function WordMeta({ word }: { word: Word }) {
  return (
    <p className="text-xs text-muted-foreground">
      {word.pos}
      {word.gender ? ` · ${word.gender}` : ""} · rank {word.rank} ·{" "}
      {word.frequency.toLocaleString()}× in the NT
    </p>
  )
}

export function ExampleQuote({ word }: { word: Word }) {
  if (!word.example) return null
  return (
    <figure className="rounded-lg bg-primary/5 p-3">
      <figcaption className="mb-1.5 text-xs font-medium text-primary">
        {word.example.reference}
      </figcaption>
      <GreekText className="block text-[15px] leading-relaxed">
        {word.example.greek}
      </GreekText>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {word.example.english}
      </p>
    </figure>
  )
}
