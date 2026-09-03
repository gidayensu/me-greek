import { describe, expect, it } from "vitest"
import {
  DIRECTION,
  LEARNING_STATUS,
  MASTERY_CORRECT_THRESHOLD,
  QUESTION_ORDER,
  QUIZ_MODE,
  SELECTION_MODE,
} from "@/lib/constants"
import { WORDS, getWord, wordsInSet } from "@/lib/vocabulary/vocabulary"
import {
  accuracyOf,
  countStatuses,
  difficultWords,
  emptyProgress,
  isDifficult,
  recordAnswer,
  studyStreak,
} from "./progress"
import {
  buildOptions,
  buildSession,
  makeRandom,
  scoreAnswers,
  shuffle,
} from "./session"
import { createUserData, mergeUserData, withSession } from "./user-data"
import type { SessionRecord, UserData, WordProgress } from "./types"

const DAY = 86_400_000

function answerTimes(
  progress: WordProgress,
  results: boolean[],
  start = 1_000
): WordProgress {
  return results.reduce(
    (acc, correct, i) => recordAnswer(acc, correct, start + i),
    progress
  )
}

describe("progress", () => {
  it("counts a first correct answer as learning, not mastered", () => {
    const p = recordAnswer(emptyProgress("w-1"), true, 1)
    expect(p.seen).toBe(1)
    expect(p.correct).toBe(1)
    expect(p.streak).toBe(1)
    expect(p.status).toBe(LEARNING_STATUS.LEARNING)
  })

  it("reaches mastery only after the threshold of consecutive correct answers", () => {
    const results = Array(MASTERY_CORRECT_THRESHOLD).fill(true)
    const p = answerTimes(emptyProgress("w-1"), results)
    expect(p.status).toBe(LEARNING_STATUS.MASTERED)

    const oneShort = answerTimes(
      emptyProgress("w-1"),
      results.slice(0, MASTERY_CORRECT_THRESHOLD - 1)
    )
    expect(oneShort.status).toBe(LEARNING_STATUS.LEARNING)
  })

  it("drops a mastered word back to learning after one wrong answer", () => {
    const mastered = answerTimes(
      emptyProgress("w-1"),
      Array(MASTERY_CORRECT_THRESHOLD).fill(true)
    )
    const slipped = recordAnswer(mastered, false, 9_999)
    expect(slipped.status).toBe(LEARNING_STATUS.LEARNING)
    expect(slipped.streak).toBe(0)
    // History is kept, not reset.
    expect(slipped.correct).toBe(MASTERY_CORRECT_THRESHOLD)
    expect(slipped.incorrect).toBe(1)
  })

  it("treats a low-accuracy word as difficult, but not on a single miss", () => {
    const oneMiss = answerTimes(emptyProgress("w-1"), [false])
    expect(isDifficult(oneMiss)).toBe(false)

    const struggling = answerTimes(emptyProgress("w-1"), [false, false, true])
    expect(accuracyOf(struggling)).toBeCloseTo(1 / 3)
    expect(isDifficult(struggling)).toBe(true)
  })

  it("honours an explicit difficult flag regardless of accuracy", () => {
    const perfect = answerTimes(emptyProgress("w-1"), [true, true, true])
    expect(isDifficult(perfect)).toBe(false)
    expect(isDifficult({ ...perfect, markedDifficult: true })).toBe(true)
  })

  it("orders difficult words hardest first", () => {
    const data = createUserData(0)
    data.progress["w-1"] = answerTimes(emptyProgress("w-1"), [false, false])
    data.progress["w-2"] = answerTimes(emptyProgress("w-2"), [false, true])
    const ordered = difficultWords(data).map((p) => p.wordId)
    expect(ordered).toEqual(["w-1", "w-2"])
  })

  it("counts every word in the pool, treating unseen words as new", () => {
    const data = createUserData(0)
    data.progress["w-1"] = answerTimes(emptyProgress("w-1"), [true])
    const counts = countStatuses(data, ["w-1", "w-2", "w-3"])
    expect(counts).toEqual({ new: 2, learning: 1, mastered: 0, total: 3 })
  })
})

describe("study streak", () => {
  const sessionOn = (endedAt: number): SessionRecord => ({
    id: `s-${endedAt}`,
    mode: QUIZ_MODE.MULTIPLE_CHOICE,
    direction: DIRECTION.GREEK_TO_ENGLISH,
    startedAt: endedAt - 1000,
    endedAt,
    wordIds: [],
    answers: [],
    newlyMastered: [],
    sourceLabel: "test",
  })

  it("is zero with no sessions", () => {
    expect(studyStreak(createUserData(0))).toBe(0)
  })

  it("counts consecutive days ending today", () => {
    const now = Date.now()
    const data = createUserData(0)
    data.sessions = [
      sessionOn(now),
      sessionOn(now - DAY),
      sessionOn(now - 2 * DAY),
    ]
    expect(studyStreak(data, now)).toBe(3)
  })

  it("survives a day that is not over yet, but breaks on a missed day", () => {
    const now = Date.now()
    const data = createUserData(0)
    data.sessions = [sessionOn(now - DAY), sessionOn(now - 2 * DAY)]
    expect(studyStreak(data, now)).toBe(2)

    const gapped = createUserData(0)
    gapped.sessions = [sessionOn(now - 3 * DAY), sessionOn(now - 4 * DAY)]
    expect(studyStreak(gapped, now)).toBe(0)
  })
})

describe("multiple choice generation", () => {
  const random = makeRandom(42)

  it("always includes the correct answer and no duplicates", () => {
    for (const word of WORDS.slice(0, 60)) {
      const options = buildOptions(word, DIRECTION.GREEK_TO_ENGLISH, random)
      expect(options).toContain(word.gloss[0])
      expect(new Set(options).size).toBe(options.length)
      expect(options).toHaveLength(4)
    }
  })

  it("offers Greek options when asking English to Greek", () => {
    const word = getWord("w-126")!
    const options = buildOptions(word, DIRECTION.ENGLISH_TO_GREEK, random)
    expect(options).toContain(word.greek)
    expect(options.every((o) => /[Ͱ-Ͽἀ-῿]/.test(o))).toBe(true)
  })

  it("respects a smaller option count", () => {
    const options = buildOptions(
      WORDS[0],
      DIRECTION.GREEK_TO_ENGLISH,
      random,
      WORDS,
      2
    )
    expect(options).toHaveLength(2)
  })
})

describe("session building", () => {
  const allStatuses = {
    includeNew: true,
    includeLearning: true,
    includeMastered: true,
  }

  it("builds a sequential session from the chosen sets, in rank order", () => {
    const built = buildSession(
      {
        selection: { mode: SELECTION_MODE.SETS, setIds: ["set-1", "set-2"] },
        statusFilter: allStatuses,
        mode: QUIZ_MODE.MULTIPLE_CHOICE,
        direction: DIRECTION.GREEK_TO_ENGLISH,
        questionOrder: QUESTION_ORDER.SEQUENTIAL,
        questionCount: 10,
      },
      createUserData(0),
      1
    )
    expect(built.poolSize).toBe(40)
    expect(built.questions).toHaveLength(10)
    expect(built.words.map((w) => w.rank)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ])
  })

  it("never returns more questions than the pool holds", () => {
    const built = buildSession(
      {
        selection: { mode: SELECTION_MODE.RANGE, fromRank: 1, toRank: 5 },
        statusFilter: allStatuses,
        mode: QUIZ_MODE.MULTIPLE_CHOICE,
        direction: DIRECTION.GREEK_TO_ENGLISH,
        questionOrder: QUESTION_ORDER.SEQUENTIAL,
        questionCount: 50,
      },
      createUserData(0),
      1
    )
    expect(built.questions).toHaveLength(5)
  })

  it("excludes mastered words when the status filter says so", () => {
    const data = createUserData(0)
    for (const word of wordsInSet("set-1").slice(0, 15)) {
      data.progress[word.id] = answerTimes(
        emptyProgress(word.id),
        Array(MASTERY_CORRECT_THRESHOLD).fill(true)
      )
    }
    const built = buildSession(
      {
        selection: { mode: SELECTION_MODE.SETS, setIds: ["set-1"] },
        statusFilter: { ...allStatuses, includeMastered: false },
        mode: QUIZ_MODE.MULTIPLE_CHOICE,
        direction: DIRECTION.GREEK_TO_ENGLISH,
        questionOrder: QUESTION_ORDER.SEQUENTIAL,
        questionCount: 20,
      },
      data,
      1
    )
    expect(built.poolSize).toBe(5)
  })

  it("puts struggling words first in adaptive order", () => {
    const data = createUserData(0)
    const set = wordsInSet("set-1")
    // Master the first five, leave the rest untouched, and make word 10 hard.
    for (const word of set.slice(0, 5)) {
      data.progress[word.id] = answerTimes(
        emptyProgress(word.id),
        Array(MASTERY_CORRECT_THRESHOLD).fill(true)
      )
    }
    data.progress[set[9].id] = answerTimes(emptyProgress(set[9].id), [
      false,
      false,
    ])

    const built = buildSession(
      {
        selection: { mode: SELECTION_MODE.SETS, setIds: ["set-1"] },
        statusFilter: allStatuses,
        mode: QUIZ_MODE.MULTIPLE_CHOICE,
        direction: DIRECTION.GREEK_TO_ENGLISH,
        questionOrder: QUESTION_ORDER.ADAPTIVE,
        questionCount: 20,
      },
      data,
      1
    )
    expect(built.words[0].id).toBe(set[9].id)
    // Mastered words sink to the end.
    expect(
      built.words
        .slice(-5)
        .map((w) => w.id)
        .sort()
    ).toEqual(
      set
        .slice(0, 5)
        .map((w) => w.id)
        .sort()
    )
  })

  it("selects difficult words when asked to", () => {
    const data = createUserData(0)
    data.progress["w-3"] = answerTimes(emptyProgress("w-3"), [false, false])
    data.progress["w-7"] = answerTimes(emptyProgress("w-7"), [false, false])
    data.progress["w-9"] = answerTimes(emptyProgress("w-9"), [true, true])

    const built = buildSession(
      {
        selection: { mode: SELECTION_MODE.DIFFICULT, limit: 10 },
        statusFilter: allStatuses,
        mode: QUIZ_MODE.MULTIPLE_CHOICE,
        direction: DIRECTION.GREEK_TO_ENGLISH,
        questionOrder: QUESTION_ORDER.SEQUENTIAL,
        questionCount: 10,
      },
      data,
      1
    )
    expect(built.words.map((w) => w.id).sort()).toEqual(["w-3", "w-7"])
  })

  it("shuffles deterministically for a given seed", () => {
    const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], makeRandom(7))
    const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8], makeRandom(7))
    const c = shuffle([1, 2, 3, 4, 5, 6, 7, 8], makeRandom(8))
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
    expect(a.slice().sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
})

describe("scoring", () => {
  it("scores an empty session without dividing by zero", () => {
    expect(scoreAnswers([])).toEqual({
      total: 0,
      correct: 0,
      incorrect: 0,
      accuracy: 0,
    })
  })

  it("scores a mixed session", () => {
    const score = scoreAnswers([
      { correct: true },
      { correct: false },
      { correct: true },
      { correct: true },
    ])
    expect(score).toEqual({
      total: 4,
      correct: 3,
      incorrect: 1,
      accuracy: 0.75,
    })
  })
})

describe("sync merge", () => {
  const sessionRecord = (id: string, endedAt: number): SessionRecord => ({
    id,
    mode: QUIZ_MODE.FLASHCARDS,
    direction: DIRECTION.GREEK_TO_ENGLISH,
    startedAt: endedAt - 1000,
    endedAt,
    wordIds: ["w-1"],
    answers: [],
    newlyMastered: [],
    sourceLabel: "test",
  })

  function deviceWith(progress: Record<string, WordProgress>): UserData {
    const data = createUserData(0)
    data.progress = progress
    return data
  }

  it("keeps the more recent record for a word touched on both devices", () => {
    const older = {
      ...emptyProgress("w-1"),
      seen: 3,
      correct: 3,
      streak: 3,
      lastSeenAt: 100,
    }
    const newer = {
      ...emptyProgress("w-1"),
      seen: 5,
      correct: 4,
      streak: 1,
      lastSeenAt: 200,
    }

    expect(
      mergeUserData(deviceWith({ "w-1": newer }), deviceWith({ "w-1": older }))
        .progress["w-1"]
    ).toEqual(newer)
    // Commutative: which side is "local" must not change the outcome.
    expect(
      mergeUserData(deviceWith({ "w-1": older }), deviceWith({ "w-1": newer }))
        .progress["w-1"]
    ).toEqual(newer)
  })

  it("does not sum counters across devices that share history", () => {
    const a = { ...emptyProgress("w-1"), seen: 4, correct: 4, lastSeenAt: 100 }
    const b = { ...emptyProgress("w-1"), seen: 6, correct: 5, lastSeenAt: 200 }
    const merged = mergeUserData(
      deviceWith({ "w-1": a }),
      deviceWith({ "w-1": b })
    )
    expect(merged.progress["w-1"].seen).toBe(6)
  })

  it("keeps progress that exists on only one device", () => {
    const merged = mergeUserData(
      deviceWith({
        "w-1": { ...emptyProgress("w-1"), seen: 1, lastSeenAt: 10 },
      }),
      deviceWith({
        "w-2": { ...emptyProgress("w-2"), seen: 1, lastSeenAt: 10 },
      })
    )
    expect(Object.keys(merged.progress).sort()).toEqual(["w-1", "w-2"])
  })

  it("unions session history from both devices without duplicating", () => {
    const local = withSession(
      withSession(createUserData(0), sessionRecord("a", 100)),
      sessionRecord("b", 200)
    )
    const remote = withSession(
      withSession(createUserData(0), sessionRecord("b", 200)),
      sessionRecord("c", 300)
    )
    const merged = mergeUserData(local, remote)
    expect(merged.sessions.map((s) => s.id).sort()).toEqual(["a", "b", "c"])
  })

  it("resolves settings as a whole object by their own timestamp", () => {
    const local = createUserData(0)
    local.settings = { ...local.settings, questionCount: 30, updatedAt: 500 }
    const remote = createUserData(0)
    remote.settings = { ...remote.settings, questionCount: 40, updatedAt: 900 }
    expect(mergeUserData(local, remote).settings.questionCount).toBe(40)
  })

  it("keeps custom lists from both sides, newest wins on conflict", () => {
    const local = createUserData(0)
    local.customLists = [
      {
        id: "l1",
        name: "Mine",
        wordIds: ["w-1"],
        createdAt: 0,
        updatedAt: 100,
      },
    ]
    const remote = createUserData(0)
    remote.customLists = [
      {
        id: "l1",
        name: "Theirs",
        wordIds: ["w-2"],
        createdAt: 0,
        updatedAt: 200,
      },
      {
        id: "l2",
        name: "Other",
        wordIds: ["w-3"],
        createdAt: 0,
        updatedAt: 50,
      },
    ]
    const merged = mergeUserData(local, remote)
    expect(merged.customLists).toHaveLength(2)
    expect(merged.customLists.find((l) => l.id === "l1")?.name).toBe("Theirs")
  })
})
