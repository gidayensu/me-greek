import {
  MEMORY_GRID_MAX_PAIRS,
  MEMORY_GRID_MIN_PAIRS,
  WORD_BUILDER_EXTRA_LETTERS,
} from "@/lib/constants"
import type { Word } from "@/lib/vocabulary/types"
import { normalizeGreek, primaryGloss } from "@/lib/vocabulary/vocabulary"
import { shuffle } from "./session"

/**
 * Rules for the four practice games. Everything here is pure and free of
 * React so the win/lose conditions can be tested directly.
 */

/* ------------------------------------------------------------------ *
 * Word Builder — reassemble the Greek spelling from letter tiles.
 * ------------------------------------------------------------------ */

/** Letters used to pad the tray. Plain lowercase — no diacritics. */
const FILLER_LETTERS = "αβγδεζηθικλμνξοπρστυφχψω".split("")

export type LetterTile = {
  /** Unique per tile: the same letter can legitimately appear twice. */
  id: string
  letter: string
}

export type WordBuilderPuzzle = {
  word: Word
  /** The letters of the answer plus distractors, shuffled. */
  tiles: LetterTile[]
  /** How many tiles a complete answer uses. */
  slots: number
}

/**
 * Splits a Greek word into the individual glyphs a learner would type.
 * Normalizing to NFC first keeps an accented vowel (ύ) as one tile rather
 * than a bare letter plus a combining mark.
 */
export function splitGreekLetters(greek: string): string[] {
  return Array.from(greek.normalize("NFC"))
}

export function buildWordBuilderPuzzle(
  word: Word,
  random: () => number,
  extraLetters = WORD_BUILDER_EXTRA_LETTERS
): WordBuilderPuzzle {
  const letters = splitGreekLetters(word.greek)

  const real: LetterTile[] = letters.map((letter, index) => ({
    id: `real-${index}`,
    letter,
  }))
  const filler: LetterTile[] = Array.from({ length: extraLetters }, (_, i) => ({
    id: `filler-${i}`,
    letter: FILLER_LETTERS[Math.floor(random() * FILLER_LETTERS.length)],
  }))

  return {
    word,
    tiles: shuffle([...real, ...filler], random),
    slots: letters.length,
  }
}

/** Renders the tiles the learner has placed, in order, as a single string. */
export function assembledWord(
  puzzle: WordBuilderPuzzle,
  placedTileIds: readonly string[]
): string {
  const byId = new Map(puzzle.tiles.map((tile) => [tile.id, tile]))
  return placedTileIds.map((id) => byId.get(id)?.letter ?? "").join("")
}

/**
 * Correct only on an exact spelling match, accents and breathings included —
 * the point of the exercise is the orthography.
 */
export function isWordBuilderSolved(
  puzzle: WordBuilderPuzzle,
  placedTileIds: readonly string[]
): boolean {
  return (
    assembledWord(puzzle, placedTileIds) === puzzle.word.greek.normalize("NFC")
  )
}

/* ------------------------------------------------------------------ *
 * Memory Grid — match each Greek card to its English card.
 * ------------------------------------------------------------------ */

export const MEMORY_CARD_FACE = {
  GREEK: "greek",
  ENGLISH: "english",
} as const
export type MemoryCardFace =
  (typeof MEMORY_CARD_FACE)[keyof typeof MEMORY_CARD_FACE]

export type MemoryCard = {
  id: string
  wordId: string
  face: MemoryCardFace
  /** What the card shows once turned over: Greek *or* English, never both. */
  text: string
}

/**
 * Builds a board of Greek/English halves. Each word contributes exactly two
 * cards — one showing only the Greek, one showing only the meaning — so the
 * match a learner has to make is Greek against English.
 */
export function buildMemoryBoard(
  words: readonly Word[],
  random: () => number,
  pairCount = MEMORY_GRID_MAX_PAIRS
): MemoryCard[] {
  const wanted = Math.min(
    Math.max(pairCount, MEMORY_GRID_MIN_PAIRS),
    MEMORY_GRID_MAX_PAIRS,
    words.length
  )
  const chosen = shuffle(words, random).slice(0, wanted)

  const cards = chosen.flatMap((word): MemoryCard[] => [
    {
      id: `${word.id}-greek`,
      wordId: word.id,
      face: MEMORY_CARD_FACE.GREEK,
      text: word.greek,
    },
    {
      id: `${word.id}-english`,
      wordId: word.id,
      face: MEMORY_CARD_FACE.ENGLISH,
      text: primaryGloss(word),
    },
  ])

  return shuffle(cards, random)
}

/**
 * A pair matches only when the two cards are the two halves of one word.
 * Requiring different faces is what stops two Greek cards — or a card
 * against itself — from counting.
 */
export function isMemoryMatch(a: MemoryCard, b: MemoryCard): boolean {
  return a.id !== b.id && a.wordId === b.wordId && a.face !== b.face
}

export function memoryPairCount(board: readonly MemoryCard[]): number {
  return board.length / 2
}

/* ------------------------------------------------------------------ *
 * Passage Hunt — find the word inside a verse.
 * ------------------------------------------------------------------ */

export type PassageToken = {
  index: number
  /** The clickable word, without surrounding punctuation. */
  text: string
  /** Punctuation rendered after the word but not part of it. */
  trailing: string
  isTarget: boolean
}

/** Only these words carry a verse the target can actually be found in. */
export function hasUsablePassage(word: Word): boolean {
  const example = word.example
  if (!example) return false
  const target = example.targetForm ?? word.greek
  return (
    tokenizePassage(word).some((token) => token.isTarget) && Boolean(target)
  )
}

const TRAILING_PUNCTUATION = /[·,.;:!?"”’)\]]+$/u
const LEADING_PUNCTUATION = /^[("“‘[]+/u

/**
 * Splits the verse into clickable words, flagging every occurrence of the
 * target. Matching is accent-insensitive so a learner is not asked to
 * distinguish ζωὴ from ζωή, and uses the recorded inflected form because
 * the headword's own spelling rarely appears verbatim.
 */
export function tokenizePassage(word: Word): PassageToken[] {
  const example = word.example
  if (!example) return []

  const target = normalizeGreek(
    stripPunctuation(example.targetForm ?? word.greek)
  )

  return example.greek
    .split(/\s+/)
    .filter(Boolean)
    .map((raw, index) => {
      const leading = LEADING_PUNCTUATION.exec(raw)?.[0] ?? ""
      const withoutLeading = raw.slice(leading.length)
      const trailing = TRAILING_PUNCTUATION.exec(withoutLeading)?.[0] ?? ""
      const text = withoutLeading.slice(
        0,
        withoutLeading.length - trailing.length
      )
      return {
        index,
        text: leading + text,
        trailing,
        isTarget: normalizeGreek(stripPunctuation(text)) === target,
      }
    })
}

function stripPunctuation(value: string): string {
  return value
    .replace(LEADING_PUNCTUATION, "")
    .replace(TRAILING_PUNCTUATION, "")
}

/** Any occurrence counts — a verse may repeat the word (John 1:1 has λόγος twice). */
export function isPassageHit(
  tokens: readonly PassageToken[],
  index: number
): boolean {
  return tokens.some((token) => token.index === index && token.isTarget)
}
