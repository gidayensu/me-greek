import { useEffect, useMemo, useState } from "react"
import { Clock01Icon, Target01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { motion, useReducedMotion } from "motion/react"
import { ProgressBar } from "@/components/ui/progress-bar"
import { GreekText } from "@/components/vocabulary/word-bits"
import {
  MEMORY_CARD_FACE,
  isMemoryMatch,
  memoryPairCount,
} from "@/lib/learning/games"
import type { MemoryCard } from "@/lib/learning/games"
import { formatDuration } from "@/lib/format"
import { cn } from "@/lib/utils"

/** How long a mismatched pair stays visible before turning back over. */
const MISMATCH_LINGER_MS = 900

export type MemoryOutcome = {
  /** Words matched without ever being part of a wrong pair. */
  cleanWordIds: string[]
  /** Words involved in at least one mismatch. */
  missedWordIds: string[]
  moves: number
  elapsedMs: number
}

/**
 * Turn over a Greek card and an English card to find a matching pair.
 *
 * Each card shows one language only — Greek on one, the meaning on the
 * other — so the pairing a learner has to recall is Greek against English.
 *
 * A word is scored as known when its pair is found without ever having been
 * part of a wrong guess; a word caught in a mismatch is recorded as missed,
 * since mistaking its meaning is what produced the wrong pair.
 */
export function MemoryGridGame({
  board,
  onComplete,
}: {
  board: MemoryCard[]
  onComplete: (outcome: MemoryOutcome) => void
}) {
  const reduced = useReducedMotion()
  const totalPairs = memoryPairCount(board)

  const [flipped, setFlipped] = useState<string[]>([])
  const [matched, setMatched] = useState<string[]>([])
  const [missed, setMissed] = useState<string[]>([])
  const [moves, setMoves] = useState(0)
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [finished, setFinished] = useState(false)

  const byId = useMemo(
    () => new Map(board.map((card) => [card.id, card])),
    [board]
  )

  // A ticking clock, stopped the moment the board is cleared.
  useEffect(() => {
    if (finished) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [finished])

  // Resolve a pair once two cards are face up.
  useEffect(() => {
    if (flipped.length < 2) return
    const [first, second] = flipped.map((id) => byId.get(id)!)

    if (isMemoryMatch(first, second)) {
      setMatched((current) => [...current, first.wordId])
      setFlipped([])
      return
    }

    setMissed((current) =>
      current.includes(first.wordId) && current.includes(second.wordId)
        ? current
        : [...new Set([...current, first.wordId, second.wordId])]
    )
    const timer = window.setTimeout(() => setFlipped([]), MISMATCH_LINGER_MS)
    return () => window.clearTimeout(timer)
  }, [flipped, byId])

  // Report once, when the last pair lands.
  useEffect(() => {
    if (finished || matched.length < totalPairs) return
    setFinished(true)
    onComplete({
      cleanWordIds: matched.filter((id) => !missed.includes(id)),
      missedWordIds: matched.filter((id) => missed.includes(id)),
      moves,
      elapsedMs: Date.now() - startedAt,
    })
  }, [matched, missed, moves, totalPairs, finished, onComplete, startedAt])

  function flip(card: MemoryCard) {
    if (finished) return
    if (flipped.length >= 2) return
    if (flipped.includes(card.id)) return
    if (matched.includes(card.wordId)) return

    const next = [...flipped, card.id]
    setFlipped(next)
    if (next.length === 2) setMoves((count) => count + 1)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          Memory grid
        </p>
        <h2 className="mt-1 font-heading text-lg font-semibold">
          Match each Greek word to its meaning
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-4 rounded-xl bg-card p-4 shadow-sm">
        <Stat icon={Clock01Icon} label="Time">
          {formatDuration(now - startedAt)}
        </Stat>
        <Stat icon={Target01Icon} label="Moves">
          {moves}
        </Stat>
        <div>
          <p className="text-xs text-muted-foreground">Progress</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">
            {matched.length} / {totalPairs}
          </p>
          <ProgressBar
            className="mt-1"
            value={(matched.length / totalPairs) * 100}
            label="Pairs matched"
          />
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {board.map((card) => {
          const isMatched = matched.includes(card.wordId)
          const isFaceUp = isMatched || flipped.includes(card.id)
          const isWrong =
            flipped.length === 2 && flipped.includes(card.id) && !isMatched

          return (
            <li key={card.id}>
              <motion.button
                type="button"
                onClick={() => flip(card)}
                disabled={isFaceUp || flipped.length >= 2}
                aria-label={
                  isFaceUp
                    ? `${card.face === MEMORY_CARD_FACE.GREEK ? "Greek" : "Meaning"}: ${card.text}`
                    : "Face-down card"
                }
                animate={reduced ? undefined : { scale: isWrong ? 0.97 : 1 }}
                className={cn(
                  "flex min-h-24 w-full items-center justify-center rounded-xl px-2 text-center transition-colors",
                  !isFaceUp && "bg-primary/80 hover:bg-primary/70",
                  isFaceUp && isMatched && "bg-success/15 text-success",
                  isFaceUp && !isMatched && isWrong && "bg-destructive/15",
                  isFaceUp && !isMatched && !isWrong && "bg-card shadow-sm"
                )}
              >
                {isFaceUp ? (
                  card.face === MEMORY_CARD_FACE.GREEK ? (
                    <GreekText className="text-xl">{card.text}</GreekText>
                  ) : (
                    <span className="text-base">{card.text}</span>
                  )
                ) : (
                  <span aria-hidden="true" className="text-2xl text-white/70">
                    ✦
                  </span>
                )}
              </motion.button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Stat({
  icon,
  label,
  children,
}: {
  icon: typeof Clock01Icon
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <HugeiconsIcon icon={icon} size={13} />
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{children}</p>
    </div>
  )
}
