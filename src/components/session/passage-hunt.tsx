import { useMemo, useState } from "react"
import {
  ArrowRight01Icon,
  Idea01Icon,
  Tick02Icon,
  ViewIcon,
  Volume01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { GreekText } from "@/components/vocabulary/word-bits"
import { isPassageHit, tokenizePassage } from "@/lib/learning/games"
import type { Word } from "@/lib/vocabulary/types"
import { canSpeak, speakGreek } from "@/lib/audio"
import { formatGloss } from "@/lib/vocabulary/vocabulary"
import { cn } from "@/lib/utils"

/**
 * Find a word inside a real verse.
 *
 * The verse shows the word inflected, not in its dictionary form, which is
 * the whole difficulty: a learner has to recognise ἠγάπησεν as ἀγαπάω.
 */
export function PassageHuntCard({
  word,
  picked,
  revealed,
  onPick,
  onSubmit,
  onSkip,
  onContinue,
}: {
  word: Word
  /** Index of the token the learner clicked, or null. */
  picked: number | null
  revealed: boolean
  onPick: (index: number) => void
  onSubmit: (correct: boolean) => void
  onSkip: () => void
  onContinue: () => void
}) {
  const [showTranslation, setShowTranslation] = useState(false)
  const [showHint, setShowHint] = useState(false)

  const tokens = useMemo(() => tokenizePassage(word), [word])
  const correct = picked !== null && isPassageHit(tokens, picked)
  const example = word.example

  if (!example) return null

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          Passage hunt
        </p>
        <h2 className="mt-1 font-heading text-lg font-semibold">
          Find the word in the passage
        </h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_240px]">
        <div className="rounded-xl bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Looking for</p>
          <div className="mt-1 flex items-center gap-2">
            <GreekText className="text-3xl">{word.greek}</GreekText>
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
          <p className="mt-1 text-sm text-muted-foreground">
            {formatGloss(word)}
          </p>
        </div>

        <div className="rounded-xl bg-primary/5 p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <HugeiconsIcon icon={Idea01Icon} size={15} />
            Hint
          </p>
          {showHint ? (
            <p className="mt-1.5 text-sm text-muted-foreground">
              The verse uses an inflected form, so the ending may differ from
              the dictionary spelling.
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

      <div className="rounded-xl bg-card p-5 shadow-sm">
        <p className="text-xs font-medium text-primary">{example.reference}</p>
        <p className="mt-2 text-2xl leading-relaxed" lang="grc">
          {tokens.map((token) => {
            const isPicked = picked === token.index
            const showAsTarget = revealed && token.isTarget
            return (
              <span key={token.index}>
                <button
                  type="button"
                  disabled={revealed}
                  onClick={() => onPick(token.index)}
                  className={cn(
                    "font-greek rounded px-1 transition-colors",
                    showAsTarget && "bg-success/25 text-success",
                    !showAsTarget &&
                      isPicked &&
                      revealed &&
                      "bg-destructive/20 text-destructive",
                    !revealed && isPicked && "bg-primary/20 text-primary",
                    !revealed && !isPicked && "hover:bg-muted"
                  )}
                >
                  {token.text}
                </button>
                {token.trailing}{" "}
              </span>
            )
          })}
        </p>

        <div className="mt-4">
          {showTranslation ? (
            <p className="text-sm text-muted-foreground">{example.english}</p>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTranslation(true)}
            >
              <HugeiconsIcon icon={ViewIcon} size={15} />
              Show translation
            </Button>
          )}
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
              {correct ? "Found it." : "Not quite."}
            </p>
            <p className="mt-1 text-sm">
              <GreekText className="font-medium">{word.greek}</GreekText>{" "}
              appears here as{" "}
              <GreekText className="font-medium text-success">
                {example.targetForm ?? word.greek}
              </GreekText>
              .
            </p>
          </div>
          <Button onClick={onContinue} className="self-end">
            Continue
            <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onSkip}>
            Skip
          </Button>
          <Button onClick={() => onSubmit(correct)} disabled={picked === null}>
            <HugeiconsIcon icon={Tick02Icon} size={16} />
            Check
          </Button>
        </div>
      )}
    </div>
  )
}
