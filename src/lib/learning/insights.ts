import { LEARNING_STATUS } from "@/lib/constants"
import type { VocabularySet } from "@/lib/vocabulary/types"
import { SETS, wordsInSet } from "@/lib/vocabulary/vocabulary"
import type { UserData, WordProgress } from "./types"
import { countStatuses, startOfDay, statusOf } from "./progress"
import type { StatusCounts } from "./progress"

export type SetProgress = {
  set: VocabularySet
  counts: StatusCounts
  /** Share of the set that is mastered, 0–1. */
  mastery: number
  /** Answer accuracy across this set's words, or null if never practised. */
  accuracy: number | null
}

export function setProgress(data: UserData, set: VocabularySet): SetProgress {
  const words = wordsInSet(set.id)
  const counts = countStatuses(
    data,
    words.map((w) => w.id)
  )

  let correct = 0
  let attempts = 0
  for (const word of words) {
    const progress: WordProgress | undefined = data.progress[word.id]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- index access is unsound without noUncheckedIndexedAccess
    if (!progress) continue
    correct += progress.correct
    attempts += progress.correct + progress.incorrect
  }

  return {
    set,
    counts,
    mastery: counts.total === 0 ? 0 : counts.mastered / counts.total,
    accuracy: attempts === 0 ? null : correct / attempts,
  }
}

export function allSetProgress(data: UserData): SetProgress[] {
  return SETS.map((set) => setProgress(data, set))
}

/**
 * Where the learner is up to: the first set that is not fully mastered.
 * Falls back to the last set once everything is mastered.
 */
export function currentSet(data: UserData): SetProgress {
  const all = allSetProgress(data)
  return all.find((entry) => entry.mastery < 1) ?? all[all.length - 1]
}

/** The next few sets worth starting, after the one in progress. */
export function recommendedSets(data: UserData, limit = 3): SetProgress[] {
  const all = allSetProgress(data)
  const current = all.findIndex((entry) => entry.mastery < 1)
  const from = current < 0 ? all.length : current
  return all.slice(from, from + limit)
}

/** Words studied today, against the daily goal. */
export function todayCount(data: UserData, now = Date.now()): number {
  const today = startOfDay(now)
  const seen = new Set<string>()
  for (const session of data.sessions) {
    if (startOfDay(session.endedAt) !== today) continue
    for (const answer of session.answers) seen.add(answer.wordId)
  }
  return seen.size
}

export function masteredCount(data: UserData): number {
  return Object.values(data.progress).filter(
    (p) => p.status === LEARNING_STATUS.MASTERED
  ).length
}

/** Words that became mastered in the last `days` days. */
export function masteredRecently(
  data: UserData,
  days = 7,
  now = Date.now()
): number {
  const cutoff = now - days * 86_400_000
  return data.sessions
    .filter((session) => session.endedAt >= cutoff)
    .reduce((total, session) => total + session.newlyMastered.length, 0)
}

export type DayPoint = { day: number; accuracy: number | null; answers: number }

/** Per-day accuracy over a trailing window, for the analytics charts. */
export function accuracyByDay(
  data: UserData,
  days = 7,
  now = Date.now()
): DayPoint[] {
  const today = startOfDay(now)
  const points: DayPoint[] = []

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = today - offset * 86_400_000
    let correct = 0
    let answers = 0
    for (const session of data.sessions) {
      if (startOfDay(session.endedAt) !== day) continue
      for (const answer of session.answers) {
        answers += 1
        if (answer.correct) correct += 1
      }
    }
    points.push({
      day,
      answers,
      accuracy: answers === 0 ? null : correct / answers,
    })
  }
  return points
}

export type PosAccuracy = { pos: string; accuracy: number; words: number }

/** Accuracy grouped by part of speech, busiest groups first. */
export function accuracyByPartOfSpeech(
  data: UserData,
  wordPos: (wordId: string) => string | undefined
): PosAccuracy[] {
  const groups = new Map<
    string,
    { correct: number; attempts: number; words: number }
  >()

  for (const progress of Object.values(data.progress)) {
    const pos = wordPos(progress.wordId)
    if (!pos) continue
    const group = groups.get(pos) ?? { correct: 0, attempts: 0, words: 0 }
    group.correct += progress.correct
    group.attempts += progress.correct + progress.incorrect
    group.words += 1
    groups.set(pos, group)
  }

  return [...groups.entries()]
    .filter(([, group]) => group.attempts > 0)
    .map(([pos, group]) => ({
      pos,
      accuracy: group.correct / group.attempts,
      words: group.words,
    }))
    .sort((a, b) => b.words - a.words)
}

/** Total time spent in finished sessions, in milliseconds. */
export function totalPracticeTime(data: UserData): number {
  return data.sessions.reduce(
    (total, session) =>
      total + Math.max(0, session.endedAt - session.startedAt),
    0
  )
}

export function statusTotals(data: UserData): StatusCounts {
  const tracked = Object.values(data.progress)
  const mastered = tracked.filter(
    (p) => p.status === LEARNING_STATUS.MASTERED
  ).length
  const learning = tracked.filter(
    (p) => p.status === LEARNING_STATUS.LEARNING
  ).length
  return {
    mastered,
    learning,
    new: 0,
    total: mastered + learning,
  }
}

export function statusOfWord(data: UserData, wordId: string) {
  return statusOf(data, wordId)
}
