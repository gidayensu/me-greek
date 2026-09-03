import {
  ArrowRight01Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { ExampleQuote, GreekText } from "@/components/vocabulary/word-bits"
import { DIRECTION } from "@/lib/constants"
import type { QuizQuestion } from "@/lib/learning/session"
import { cn } from "@/lib/utils"

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const

export function MultipleChoiceCard({
  question,
  chosen,
  revealed,
  showTransliteration,
  onChoose,
  onSubmit,
  onSkip,
  onContinue,
}: {
  question: QuizQuestion
  /** The option the learner has picked, before or after submitting. */
  chosen: string | null
  /** True once the answer has been checked and feedback is on screen. */
  revealed: boolean
  showTransliteration: boolean
  onChoose: (option: string) => void
  onSubmit: () => void
  onSkip: () => void
  onContinue: () => void
}) {
  const greekPrompt = question.direction === DIRECTION.GREEK_TO_ENGLISH
  const correct = revealed && chosen === question.answer

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          Multiple choice
        </p>
        <h2 className="mt-1 font-heading text-lg font-semibold">
          {greekPrompt
            ? "What does this word mean?"
            : "Which Greek word means this?"}
        </h2>
      </div>

      <div className="rounded-xl bg-card p-6 text-center shadow-sm">
        {greekPrompt ? (
          <>
            <GreekText className="text-4xl leading-tight md:text-5xl">
              {question.prompt}
            </GreekText>
            {showTransliteration ? (
              <p className="mt-2 text-base text-primary">
                {question.word.transliteration}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-3xl font-medium md:text-4xl">{question.prompt}</p>
        )}
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {question.options.map((option, index) => {
          const isChosen = chosen === option
          const isAnswer = option === question.answer
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
                  "flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors",
                  state === "idle" &&
                    "bg-muted/60 hover:bg-muted disabled:opacity-60",
                  state === "chosen" && "bg-primary/15 text-primary",
                  state === "correct" && "bg-success/20 text-success",
                  state === "wrong" && "bg-destructive/15 text-destructive"
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-md bg-background/70 text-xs font-medium",
                    state === "chosen" && "text-primary",
                    state === "correct" && "text-success",
                    state === "wrong" && "text-destructive"
                  )}
                >
                  {OPTION_LETTERS[index] ?? index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  {greekPrompt ? (
                    option
                  ) : (
                    <GreekText className="text-lg">{option}</GreekText>
                  )}
                </span>
                {state === "correct" ? (
                  <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    size={17}
                    className="shrink-0 text-success"
                  />
                ) : null}
                {state === "wrong" ? (
                  <HugeiconsIcon
                    icon={CancelCircleIcon}
                    size={17}
                    className="shrink-0 text-destructive"
                  />
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
            {!correct ? (
              <p className="mt-1 text-sm">
                The answer is{" "}
                <span className="font-medium text-success">
                  {greekPrompt ? (
                    question.answer
                  ) : (
                    <GreekText>{question.answer}</GreekText>
                  )}
                </span>
                .
              </p>
            ) : null}
          </div>

          <ExampleQuote word={question.word} />

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
          <Button onClick={onSubmit} disabled={chosen === null}>
            Submit
          </Button>
        </div>
      )}
    </div>
  )
}
