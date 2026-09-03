import {
  DIRECTION,
  LEARNING_STATUS,
  MULTIPLE_CHOICE_OPTIONS,
  QUESTION_ORDER,
  QUIZ_MODE,
  SELECTION_MODE,
  WORD_BUILDER_MIN_LETTERS,
} from "@/lib/constants"
import type { Direction, QuizMode } from "@/lib/constants"
import type { Word } from "@/lib/vocabulary/types"
import {
  WORDS,
  getWords,
  primaryGloss,
  wordsInRange,
  wordsInSets,
} from "@/lib/vocabulary/vocabulary"
import type { PracticeConfig, SelectionSpec, UserData } from "./types"
import { difficultWords, progressFor, statusOf } from "./progress"
import { hasUsablePassage, splitGreekLetters } from "./games"

/** Deterministic PRNG so a session can be rebuilt from a seed if needed. */
export function makeRandom(seed: number): () => number {
  let state = seed >>> 0 || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 0x100000000
  }
}

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** The pool a selection describes, before status filtering or trimming. */
export function resolveSelection(
  selection: SelectionSpec,
  data: UserData
): Word[] {
  switch (selection.mode) {
    case SELECTION_MODE.SETS:
      return wordsInSets(selection.setIds)
    case SELECTION_MODE.RANGE:
      return wordsInRange(selection.fromRank, selection.toRank)
    case SELECTION_MODE.CUSTOM:
      return getWords(selection.wordIds)
    case SELECTION_MODE.DIFFICULT:
      return getWords(
        difficultWords(data)
          .slice(0, selection.limit)
          .map((progress) => progress.wordId)
      )
  }
}

/**
 * Some games need more than a headword: Passage Hunt needs a verse the word
 * can actually be found in. Filtering here means the practice wizard's live
 * preview shows the true pool size before a session ever starts.
 */
export function supportsMode(word: Word, mode: QuizMode): boolean {
  if (mode === QUIZ_MODE.PASSAGE_HUNT) return hasUsablePassage(word)
  if (mode === QUIZ_MODE.WORD_BUILDER) {
    return splitGreekLetters(word.greek).length >= WORD_BUILDER_MIN_LETTERS
  }
  return true
}

/**
 * Some games fix the direction their questions are built in, whatever the
 * learner chose. Listening Quest plays Greek audio, so its options have to be
 * Greek spellings; Word Builder shows an English clue and is answered in
 * Greek. Asking those the other way round makes them unanswerable.
 */
export function questionDirectionFor(
  mode: QuizMode,
  configured: Direction
): Direction {
  if (
    mode === QUIZ_MODE.LISTENING_QUEST ||
    mode === QUIZ_MODE.WORD_BUILDER
  ) {
    return DIRECTION.ENGLISH_TO_GREEK
  }
  return configured
}

export function applyStatusFilter(
  words: readonly Word[],
  data: UserData,
  filter: PracticeConfig["statusFilter"]
): Word[] {
  return words.filter((word) => {
    const status = statusOf(data, word.id)
    if (status === LEARNING_STATUS.NEW) return filter.includeNew
    if (status === LEARNING_STATUS.LEARNING) return filter.includeLearning
    return filter.includeMastered
  })
}

/**
 * Adaptive order: least-known first. Words never seen come before words being
 * learned, which come before mastered ones; ties break on lower accuracy and
 * then on how long ago the word was last seen.
 */
function adaptiveSort(words: readonly Word[], data: UserData): Word[] {
  const weight = {
    [LEARNING_STATUS.LEARNING]: 0,
    [LEARNING_STATUS.NEW]: 1,
    [LEARNING_STATUS.MASTERED]: 2,
  }
  return words.slice().sort((a, b) => {
    const pa = progressFor(data, a.id)
    const pb = progressFor(data, b.id)
    const byStatus = weight[pa.status] - weight[pb.status]
    if (byStatus !== 0) return byStatus
    const attemptsA = pa.correct + pa.incorrect
    const attemptsB = pb.correct + pb.incorrect
    const accA = attemptsA === 0 ? 1 : pa.correct / attemptsA
    const accB = attemptsB === 0 ? 1 : pb.correct / attemptsB
    if (accA !== accB) return accA - accB
    return pa.lastSeenAt - pb.lastSeenAt
  })
}

export type QuizQuestion = {
  word: Word
  /** What the user is shown. */
  prompt: string
  /** The correct answer text. */
  answer: string
  /** Shuffled choices including the answer. Empty for flashcards. */
  options: string[]
  direction: Direction
}

/**
 * Builds distractors from words of the same part of speech where possible,
 * falling back to the wider vocabulary. Distractor text is deduplicated so a
 * question never shows the same meaning twice.
 */
export function buildOptions(
  word: Word,
  direction: Direction,
  random: () => number,
  pool: readonly Word[] = WORDS,
  optionCount = MULTIPLE_CHOICE_OPTIONS
): string[] {
  const textOf = (w: Word) =>
    direction === DIRECTION.GREEK_TO_ENGLISH ? primaryGloss(w) : w.greek

  const answer = textOf(word)
  const taken = new Set([answer])
  const distractors: string[] = []

  const sameKind = pool.filter((w) => w.id !== word.id && w.pos === word.pos)
  const others = pool.filter((w) => w.id !== word.id && w.pos !== word.pos)

  for (const candidate of [
    ...shuffle(sameKind, random),
    ...shuffle(others, random),
  ]) {
    if (distractors.length >= optionCount - 1) break
    const text = textOf(candidate)
    if (!text || taken.has(text)) continue
    taken.add(text)
    distractors.push(text)
  }

  return shuffle([answer, ...distractors], random)
}

export function buildQuestions(
  words: readonly Word[],
  direction: Direction,
  random: () => number,
  optionCount = MULTIPLE_CHOICE_OPTIONS
): QuizQuestion[] {
  return words.map((word) => ({
    word,
    prompt:
      direction === DIRECTION.GREEK_TO_ENGLISH
        ? word.greek
        : primaryGloss(word),
    answer:
      direction === DIRECTION.GREEK_TO_ENGLISH
        ? primaryGloss(word)
        : word.greek,
    options: buildOptions(word, direction, random, WORDS, optionCount),
    direction,
  }))
}

export type BuiltSession = {
  words: Word[]
  questions: QuizQuestion[]
  /** Pool size before the question count trimmed it — shown in the summary. */
  poolSize: number
}

/**
 * Turns a practice configuration into an ordered list of questions.
 * Returns fewer questions than requested when the pool is smaller; callers
 * must handle an empty result rather than assuming a fixed length.
 */
export function buildSession(
  config: PracticeConfig,
  data: UserData,
  seed: number = Date.now()
): BuiltSession {
  const random = makeRandom(seed)
  const pool = applyStatusFilter(
    resolveSelection(config.selection, data),
    data,
    config.statusFilter
  ).filter((word) => supportsMode(word, config.mode))

  let ordered: Word[]
  if (config.questionOrder === QUESTION_ORDER.RANDOM) {
    ordered = shuffle(pool, random)
  } else if (config.questionOrder === QUESTION_ORDER.ADAPTIVE) {
    ordered = adaptiveSort(pool, data)
  } else {
    ordered = pool.slice().sort((a, b) => a.rank - b.rank)
  }

  const words = ordered.slice(0, Math.max(0, config.questionCount))
  return {
    words,
    questions: buildQuestions(
      words,
      questionDirectionFor(config.mode, config.direction),
      random
    ),
    poolSize: pool.length,
  }
}

export type SessionScore = {
  total: number
  correct: number
  incorrect: number
  accuracy: number
}

export function scoreAnswers(
  answers: readonly { correct: boolean }[]
): SessionScore {
  const correct = answers.filter((a) => a.correct).length
  const total = answers.length
  return {
    total,
    correct,
    incorrect: total - correct,
    accuracy: total === 0 ? 0 : correct / total,
  }
}
