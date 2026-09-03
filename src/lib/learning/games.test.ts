import { describe, expect, it } from "vitest"
import {
  DIRECTION,
  MEMORY_GRID_MAX_PAIRS,
  QUESTION_ORDER,
  QUIZ_MODE,
  SELECTION_MODE,
} from "@/lib/constants"
import { WORDS, getWord, primaryGloss } from "@/lib/vocabulary/vocabulary"
import {
  MEMORY_CARD_FACE,
  assembledWord,
  buildMemoryBoard,
  buildWordBuilderPuzzle,
  hasUsablePassage,
  isMemoryMatch,
  isPassageHit,
  isWordBuilderSolved,
  splitGreekLetters,
  tokenizePassage,
} from "./games"
import { buildSession, makeRandom } from "./session"
import { createUserData } from "./user-data"

const random = () => makeRandom(11)

describe("word builder", () => {
  it("keeps an accented vowel as a single tile", () => {
    // δικαιοσύνη carries an acute on the upsilon; it must not split in two.
    expect(splitGreekLetters("δικαιοσύνη")).toEqual([
      "δ",
      "ι",
      "κ",
      "α",
      "ι",
      "ο",
      "σ",
      "ύ",
      "ν",
      "η",
    ])
  })

  it("offers every letter of the answer plus distractors", () => {
    const word = getWord("w-181")! // δικαιοσύνη
    const puzzle = buildWordBuilderPuzzle(word, random(), 6)
    expect(puzzle.slots).toBe(10)
    expect(puzzle.tiles).toHaveLength(16)

    // Every letter of the answer is present, counting duplicates.
    const tray = puzzle.tiles.map((t) => t.letter).sort()
    for (const letter of splitGreekLetters(word.greek)) {
      const at = tray.indexOf(letter)
      expect(at).toBeGreaterThanOrEqual(0)
      tray.splice(at, 1)
    }
  })

  it("accepts the exact spelling and nothing else", () => {
    const word = getWord("w-126")! // ζωή
    const puzzle = buildWordBuilderPuzzle(word, random(), 4)

    const answerIds = splitGreekLetters(word.greek).map((letter) => {
      const tile = puzzle.tiles.find(
        (t) => t.letter === letter && t.id.startsWith("real-")
      )!
      return tile.id
    })
    expect(assembledWord(puzzle, answerIds)).toBe("ζωή")
    expect(isWordBuilderSolved(puzzle, answerIds)).toBe(true)

    // Right letters, wrong order.
    expect(isWordBuilderSolved(puzzle, [...answerIds].reverse())).toBe(false)
    // Incomplete.
    expect(isWordBuilderSolved(puzzle, answerIds.slice(0, 2))).toBe(false)
    expect(isWordBuilderSolved(puzzle, [])).toBe(false)
  })

  it("treats an unaccented spelling as wrong", () => {
    const word = getWord("w-126")! // ζωή, not ζωη
    const puzzle = buildWordBuilderPuzzle(word, random(), 0)
    const ids = puzzle.tiles.filter((t) => t.letter !== "ή").map((t) => t.id)
    expect(isWordBuilderSolved(puzzle, ids)).toBe(false)
  })
})

describe("memory grid", () => {
  const words = WORDS.slice(0, 6)

  it("gives each word one Greek card and one English card", () => {
    const board = buildMemoryBoard(words, random(), 4)
    expect(board).toHaveLength(8)

    for (const word of new Set(board.map((c) => c.wordId))) {
      const cards = board.filter((c) => c.wordId === word)
      expect(cards).toHaveLength(2)
      expect(cards.map((c) => c.face).sort()).toEqual(["english", "greek"])
    }
  })

  it("never puts Greek and English on the same card", () => {
    const board = buildMemoryBoard(words, random(), 4)
    for (const card of board) {
      const word = getWord(card.wordId)!
      if (card.face === MEMORY_CARD_FACE.GREEK) {
        expect(card.text).toBe(word.greek)
        expect(card.text).not.toContain(primaryGloss(word))
      } else {
        expect(card.text).toBe(primaryGloss(word))
        expect(card.text).not.toContain(word.greek)
      }
    }
  })

  it("matches a Greek card only against its own English card", () => {
    const board = buildMemoryBoard(words, random(), 4)
    const greek = board.find((c) => c.face === MEMORY_CARD_FACE.GREEK)!
    const english = board.find(
      (c) => c.wordId === greek.wordId && c.face === MEMORY_CARD_FACE.ENGLISH
    )!
    const otherGreek = board.find(
      (c) => c.face === MEMORY_CARD_FACE.GREEK && c.wordId !== greek.wordId
    )!
    const otherEnglish = board.find(
      (c) => c.face === MEMORY_CARD_FACE.ENGLISH && c.wordId !== greek.wordId
    )!

    expect(isMemoryMatch(greek, english)).toBe(true)
    expect(isMemoryMatch(english, greek)).toBe(true)
    // Same word, same face — impossible, but must not count.
    expect(isMemoryMatch(greek, greek)).toBe(false)
    // Different words never match, in either direction.
    expect(isMemoryMatch(greek, otherGreek)).toBe(false)
    expect(isMemoryMatch(greek, otherEnglish)).toBe(false)
  })

  it("caps the board and never asks for more pairs than there are words", () => {
    expect(buildMemoryBoard(words, random(), 99)).toHaveLength(
      Math.min(words.length, MEMORY_GRID_MAX_PAIRS) * 2
    )
    expect(buildMemoryBoard(WORDS.slice(0, 3), random(), 8)).toHaveLength(6)
  })
})

describe("mode-specific question shape", () => {
  const everything = {
    includeNew: true,
    includeLearning: true,
    includeMastered: true,
  }

  function build(mode: (typeof QUIZ_MODE)[keyof typeof QUIZ_MODE]) {
    return buildSession(
      {
        selection: { mode: SELECTION_MODE.RANGE, fromRank: 1, toRank: 60 },
        statusFilter: everything,
        mode,
        // Deliberately the direction that would break these games if honoured.
        direction: DIRECTION.GREEK_TO_ENGLISH,
        questionOrder: QUESTION_ORDER.SEQUENTIAL,
        questionCount: 10,
      },
      createUserData(0),
      3
    )
  }

  it("offers Greek spellings to choose from in Listening Quest", () => {
    // You hear Greek, so the options must be Greek — never the meanings.
    const built = build(QUIZ_MODE.LISTENING_QUEST)
    expect(built.questions.length).toBeGreaterThan(0)
    for (const question of built.questions) {
      expect(question.options).toContain(question.word.greek)
      expect(question.options).not.toContain(primaryGloss(question.word))
    }
  })

  it("leaves Multiple Choice reading in the chosen direction", () => {
    const built = build(QUIZ_MODE.MULTIPLE_CHOICE)
    for (const question of built.questions) {
      expect(question.options).toContain(primaryGloss(question.word))
    }
  })

  it("keeps one- and two-letter words out of Word Builder", () => {
    const built = build(QUIZ_MODE.WORD_BUILDER)
    expect(built.questions.length).toBeGreaterThan(0)
    for (const word of built.words) {
      expect(splitGreekLetters(word.greek).length).toBeGreaterThanOrEqual(3)
    }
    // Those short words are still fair game elsewhere.
    expect(build(QUIZ_MODE.MULTIPLE_CHOICE).poolSize).toBeGreaterThan(
      built.poolSize
    )
  })
})

describe("passage hunt", () => {
  it("finds the headword when the verse uses that exact form", () => {
    const tokens = tokenizePassage(getWord("w-54")!) // λόγος, John 1:1
    const targets = tokens.filter((t) => t.isTarget)
    expect(targets).toHaveLength(1)
    expect(targets[0].text).toBe("λόγος")
  })

  it("finds an inflected form the headword's own spelling would miss", () => {
    // ἀγαπάω appears as ἠγάπησεν — no shared prefix with the headword.
    const tokens = tokenizePassage(getWord("w-117")!)
    const targets = tokens.filter((t) => t.isTarget)
    expect(targets).toHaveLength(1)
    expect(targets[0].text).toBe("ἠγάπησεν")
  })

  it("ignores the accent difference between headword and verse", () => {
    // Headword ζωή, verse has ζωὴ with a grave — and twice.
    const tokens = tokenizePassage(getWord("w-126")!)
    expect(tokens.filter((t) => t.isTarget)).toHaveLength(2)
  })

  it("separates trailing punctuation from the clickable word", () => {
    const tokens = tokenizePassage(getWord("w-126")!)
    const comma = tokens.find((t) => t.trailing === ",")
    expect(comma).toBeDefined()
    expect(comma!.text).not.toContain(",")
  })

  it("counts a click on any occurrence as a hit", () => {
    const tokens = tokenizePassage(getWord("w-126")!)
    const targets = tokens.filter((t) => t.isTarget)
    expect(isPassageHit(tokens, targets[0].index)).toBe(true)
    expect(isPassageHit(tokens, targets[1].index)).toBe(true)

    const miss = tokens.find((t) => !t.isTarget)!
    expect(isPassageHit(tokens, miss.index)).toBe(false)
  })

  it("only accepts words whose verse actually contains them", () => {
    expect(hasUsablePassage(getWord("w-54")!)).toBe(true) // has a verse
    expect(hasUsablePassage(getWord("w-1")!)).toBe(false) // no verse at all

    // Every example in the dataset must be usable, or the game silently
    // shrinks its pool.
    const withExample = WORDS.filter((w) => w.example)
    expect(withExample.length).toBeGreaterThan(0)
    expect(withExample.every(hasUsablePassage)).toBe(true)
  })

  it("restricts a Passage Hunt session to words that have a verse", () => {
    const built = buildSession(
      {
        selection: { mode: SELECTION_MODE.RANGE, fromRank: 1, toRank: 240 },
        statusFilter: {
          includeNew: true,
          includeLearning: true,
          includeMastered: true,
        },
        mode: QUIZ_MODE.PASSAGE_HUNT,
        direction: DIRECTION.GREEK_TO_ENGLISH,
        questionOrder: QUESTION_ORDER.SEQUENTIAL,
        questionCount: 50,
      },
      createUserData(0),
      1
    )
    expect(built.words.length).toBeGreaterThan(0)
    expect(built.words.every(hasUsablePassage)).toBe(true)
    // Other modes are not restricted this way.
    expect(built.poolSize).toBeLessThan(WORDS.length)
  })
})
