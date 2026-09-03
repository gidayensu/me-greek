import { useMemo, useState } from "react"
import {
  ArrowRight01Icon,
  Idea01Icon,
  Tick02Icon,
  Volume01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { ExampleQuote, GreekText } from "@/components/vocabulary/word-bits"
import { assembledWord, isWordBuilderSolved } from "@/lib/learning/games"
import type { WordBuilderPuzzle } from "@/lib/learning/games"
import { canSpeak, speakGreek } from "@/lib/audio"
import { formatGloss } from "@/lib/vocabulary/vocabulary"
import { cn } from "@/lib/utils"

/**
 * Spell the Greek word from letter tiles, prompted by the English meaning.
 * Tiles are placed in order and can be taken back until the answer is checked.
 */
export function WordBuilderCard({
  puzzle,
  revealed,
  onSubmit,
  onSkip,
  onContinue,
}: {
  puzzle: WordBuilderPuzzle
  revealed: boolean
  onSubmit: (correct: boolean, attempt: string) => void
  onSkip: () => void
  onContinue: () => void
}) {
  const [placed, setPlaced] = useState<string[]>([])
  const [showHint, setShowHint] = useState(false)

  const { word } = puzzle
  const attempt = useMemo(() => assembledWord(puzzle, placed), [puzzle, placed])
  const correct = isWordBuilderSolved(puzzle, placed)
  const used = new Set(placed)

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          Word builder
        </p>
        <h2 className="mt-1 font-heading text-lg font-semibold">
          Spell the Greek word
        </h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_260px]">
        <div className="rounded-xl bg-card p-5 shadow-sm">
          <p className="text-xs text-muted-foreground">English clue</p>
          <p className="mt-1 text-2xl font-medium">{formatGloss(word)}</p>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Transliteration</p>
              <p className="mt-0.5 text-lg text-primary">
                {word.transliteration}
              </p>
            </div>
            {canSpeak() ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Hear the word"
                onClick={() => speakGreek(word.greek)}
              >
                <HugeiconsIcon icon={Volume01Icon} size={16} />
              </Button>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl bg-primary/5 p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <HugeiconsIcon icon={Idea01Icon} size={15} />
            Hint
          </p>
          {showHint ? (
            <p className="mt-1.5 text-sm text-muted-foreground">
              {word.pos}
              {word.gender ? `, ${word.gender}` : ""} · starts with{" "}
              <GreekText className="font-medium text-foreground">
                {Array.from(word.greek)[0]}
              </GreekText>{" "}
              · {puzzle.slots} letters
            </p>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1"
              onClick={() => setShowHint(true)}
            >
              Show hint
            </Button>
          )}
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground">Build the word</p>
        <div className="mt-2 flex flex-wrap gap-1.5" aria-live="polite">
          {Array.from({ length: puzzle.slots }).map((_, slot) => {
            const tileId = placed[slot]
            const tile = puzzle.tiles.find((t) => t.id === tileId)
            return (
              <button
                key={slot}
                type="button"
                disabled={!tile || revealed}
                aria-label={
                  tile ? `Remove ${tile.letter}` : `Empty slot ${slot + 1}`
                }
                onClick={() =>
                  setPlaced((current) => current.filter((id) => id !== tileId))
                }
                className={cn(
                  "flex size-11 items-center justify-center rounded-lg text-xl transition-colors",
                  tile ? "bg-primary/15 text-primary" : "bg-muted"
                )}
              >
                {tile ? <GreekText>{tile.letter}</GreekText> : null}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground">Available letters</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {puzzle.tiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              disabled={
                used.has(tile.id) || revealed || placed.length >= puzzle.slots
              }
              onClick={() => setPlaced((current) => [...current, tile.id])}
              className={cn(
                "flex size-11 items-center justify-center rounded-lg bg-card text-xl shadow-sm transition-colors",
                used.has(tile.id)
                  ? "pointer-events-none opacity-30"
                  : "hover:bg-muted"
              )}
            >
              <GreekText>{tile.letter}</GreekText>
            </button>
          ))}
        </div>
      </div>

      {revealed ? (
        <div className="flex flex-col gap-4">
          <div
            className={cn(
              "rounded-xl p-4 text-center",
              correct ? "bg-success/15" : "bg-destructive/15"
            )}
          >
            <p
              className={cn(
                "font-heading text-lg font-semibold",
                correct ? "text-success" : "text-destructive"
              )}
            >
              {correct ? "Correct." : "Not quite."}
            </p>
            {!correct ? (
              <p className="mt-1 text-sm">
                {attempt ? (
                  <>
                    You spelled <GreekText>{attempt}</GreekText>. The answer
                    is{" "}
                  </>
                ) : (
                  "The answer is "
                )}
                <GreekText className="font-medium text-success">
                  {word.greek}
                </GreekText>
                .
              </p>
            ) : null}
          </div>
          <ExampleQuote word={word} />
          <Button onClick={onContinue} className="self-end">
            Continue
            <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onSkip}>
              Skip
            </Button>
            <Button
              variant="outline"
              onClick={() => setPlaced([])}
              disabled={placed.length === 0}
            >
              Clear
            </Button>
          </div>
          <Button
            onClick={() => onSubmit(correct, attempt)}
            disabled={placed.length === 0}
          >
            <HugeiconsIcon icon={Tick02Icon} size={16} />
            Check
          </Button>
        </div>
      )}
    </div>
  )
}
