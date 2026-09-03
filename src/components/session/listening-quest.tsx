import { useEffect, useState } from "react"
import {
  ArrowRight01Icon,
  PlayIcon,
  RefreshIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { ExampleQuote, GreekText } from "@/components/vocabulary/word-bits"
import { LISTENING_REPLAY_SPEEDS } from "@/lib/constants"
import type { QuizQuestion } from "@/lib/learning/session"
import { canSpeak, speakGreek, stopSpeaking } from "@/lib/audio"
import { getWordByGreek, primaryGloss } from "@/lib/vocabulary/vocabulary"
import { cn } from "@/lib/utils"

/**
 * Hear a Greek word and pick it out of four spellings.
 *
 * The word is spoken rather than shown, so the options carry both the Greek
 * and its meaning — the learner is identifying what they heard, not
 * translating it.
 */
export function ListeningQuestCard({
  question,
  chosen,
  revealed,
  onChoose,
  onSubmit,
  onSkip,
  onContinue,
}: {
  question: QuizQuestion
  chosen: string | null
  revealed: boolean
  onChoose: (option: string) => void
  onSubmit: () => void
  onSkip: () => void
  onContinue: () => void
}) {
  const [speed, setSpeed] = useState<number>(1)
  const { word } = question
  const correct = revealed && chosen === word.greek
  const speechAvailable = canSpeak()

  // Play on arrival, and stop any audio when the card is left behind.
  useEffect(() => {
    speakGreek(word.greek, speed)
    return stopSpeaking
    // Keyed on the word alone: changing the speed control replays on its own
    // click, and should not also retrigger from this effect.
  }, [word.greek])

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          Listening quest
        </p>
        <h2 className="mt-1 font-heading text-lg font-semibold">
          Which word did you hear?
        </h2>
      </div>

      {!speechAvailable ? (
        <p className="rounded-xl bg-warning/15 p-4 text-center text-sm">
          This browser cannot speak Greek, so the word is shown instead:{" "}
          <GreekText className="font-medium">{word.greek}</GreekText>
        </p>
      ) : (
        <div className="flex items-center gap-4 rounded-xl bg-card p-5 shadow-sm">
          <Button
            size="icon-lg"
            aria-label="Play the word"
            onClick={() => speakGreek(word.greek, speed)}
          >
            <HugeiconsIcon icon={PlayIcon} size={20} />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Listen carefully</p>
            <p className="text-xs text-muted-foreground">
              Play it as often as you need before answering.
            </p>
          </div>
        </div>
      )}

      <ul className="grid gap-2 sm:grid-cols-2">
        {question.options.map((option) => {
          const optionWord = getWordByGreek(option)
          const isChosen = chosen === option
          const isAnswer = option === word.greek
          const state = !revealed
            ? isChosen
              ? "chosen"
              : "idle"
            : isAnswer
              ? "correct"
              : isChosen
                ? "wrong"
                : "idle"

          return (
            <li key={option}>
              <button
                type="button"
                disabled={revealed}
                onClick={() => onChoose(option)}
                aria-pressed={isChosen}
                className={cn(
                  "w-full rounded-xl px-3.5 py-3 text-center transition-colors",
                  state === "idle" && "bg-muted/60 hover:bg-muted",
                  state === "chosen" && "bg-primary/15 text-primary",
                  state === "correct" && "bg-success/20 text-success",
                  state === "wrong" && "bg-destructive/15 text-destructive"
                )}
              >
                <GreekText className="block text-xl">{option}</GreekText>
                {optionWord ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {primaryGloss(optionWord)}
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>

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
            <p className="mt-1 text-sm">
              You heard{" "}
              <GreekText className="font-medium">{word.greek}</GreekText> —{" "}
              {primaryGloss(word)}.
            </p>
          </div>
          <ExampleQuote word={word} />
          <Button onClick={onContinue} className="self-end">
            Continue
            <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Speed</span>
            {LISTENING_REPLAY_SPEEDS.map((option) => (
              <Button
                key={option}
                size="xs"
                variant={speed === option ? "default" : "outline"}
                onClick={() => {
                  setSpeed(option)
                  speakGreek(word.greek, option)
                }}
                disabled={!speechAvailable}
              >
                {option}×
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => speakGreek(word.greek, speed)}
              disabled={!speechAvailable}
            >
              <HugeiconsIcon icon={RefreshIcon} size={15} />
              Replay
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onSkip}>
              Skip
            </Button>
            <Button onClick={onSubmit} disabled={chosen === null}>
              <HugeiconsIcon icon={Tick02Icon} size={16} />
              Check
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
