import { RefreshIcon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { motion, useReducedMotion } from "motion/react"
import { Button } from "@/components/ui/button"
import {
  ExampleQuote,
  GreekText,
  WordMeta,
} from "@/components/vocabulary/word-bits"
import { DIRECTION } from "@/lib/constants"
import type { QuizQuestion } from "@/lib/learning/session"
import { formatGloss } from "@/lib/vocabulary/vocabulary"

/**
 * Flashcards record self-assessed recall: "I know this" counts as correct,
 * "Needs practice" as incorrect, so mastery and difficulty follow the same
 * rules as a quiz.
 */
export function FlashcardCard({
  question,
  flipped,
  showTransliteration,
  onFlip,
  onRespond,
}: {
  question: QuizQuestion
  flipped: boolean
  showTransliteration: boolean
  onFlip: () => void
  onRespond: (knewIt: boolean) => void
}) {
  const reduced = useReducedMotion()
  const { word } = question
  const greekFront = question.direction === DIRECTION.GREEK_TO_ENGLISH

  return (
    <div className="flex flex-col gap-5">
      <p className="text-center text-xs font-medium tracking-wide text-primary uppercase">
        Flashcard
      </p>

      <motion.button
        type="button"
        onClick={onFlip}
        aria-expanded={flipped}
        className="min-h-64 rounded-2xl bg-card p-8 text-center shadow-sm transition-colors"
        animate={{ scale: 1 }}
        whileTap={reduced ? undefined : { scale: 0.99 }}
      >
        {!flipped ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3">
            {greekFront ? (
              <>
                <GreekText className="text-5xl leading-tight md:text-6xl">
                  {word.greek}
                </GreekText>
                {showTransliteration ? (
                  <p className="text-lg text-primary">{word.transliteration}</p>
                ) : null}
              </>
            ) : (
              <p className="text-3xl font-medium md:text-4xl">
                {formatGloss(word)}
              </p>
            )}
            <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
              <HugeiconsIcon icon={RefreshIcon} size={13} />
              Click to reveal
            </p>
          </div>
        ) : (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col items-center gap-3"
          >
            {greekFront ? (
              <p className="text-3xl font-medium md:text-4xl">
                {formatGloss(word)}
              </p>
            ) : (
              <>
                <GreekText className="text-4xl leading-tight md:text-5xl">
                  {word.greek}
                </GreekText>
                <p className="text-base text-primary">{word.transliteration}</p>
              </>
            )}
            <WordMeta word={word} />
            {word.note ? (
              <p className="max-w-md text-sm text-muted-foreground">
                {word.note}
              </p>
            ) : null}
            {word.example ? (
              <div className="mt-2 w-full max-w-md text-left">
                <ExampleQuote word={word} />
              </div>
            ) : null}
          </motion.div>
        )}
      </motion.button>

      {flipped ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" onClick={() => onRespond(false)}>
            <HugeiconsIcon icon={RefreshIcon} size={16} />
            Needs practice
          </Button>
          <Button onClick={() => onRespond(true)}>
            <HugeiconsIcon icon={Tick02Icon} size={16} />I know this
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={onFlip} className="self-center">
          Reveal meaning
        </Button>
      )}
    </div>
  )
}
