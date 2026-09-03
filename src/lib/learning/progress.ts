import {
  DIFFICULT_ACCURACY_THRESHOLD,
  DIFFICULT_MIN_ATTEMPTS,
  LEARNING_STATUS,
  MASTERY_CORRECT_THRESHOLD,
} from "@/lib/constants"
import type { LearningStatus } from "@/lib/constants"
import type { UserData, WordProgress } from "./types"

export function emptyProgress(wordId: string): WordProgress {
  return {
    wordId,
    seen: 0,
    correct: 0,
    incorrect: 0,
    status: LEARNING_STATUS.NEW,
    streak: 0,
    lastSeenAt: 0,
  }
}

export function progressFor(data: UserData, wordId: string): WordProgress {
  return data.progress[wordId] ?? emptyProgress(wordId)
}

export function statusOf(data: UserData, wordId: string): LearningStatus {
  return progressFor(data, wordId).status
}

export function accuracyOf(progress: WordProgress): number {
  const attempts = progress.correct + progress.incorrect
  return attempts === 0 ? 0 : progress.correct / attempts
}

/**
 * A word is mastered once it has been answered correctly at least
 * MASTERY_CORRECT_THRESHOLD times *in a row*. A single wrong answer drops it
 * back to `learning` — mastery is a claim about current recall, not history.
 */
export function deriveStatus(progress: WordProgress): LearningStatus {
  if (progress.seen === 0) return LEARNING_STATUS.NEW
  if (progress.streak >= MASTERY_CORRECT_THRESHOLD) {
    return LEARNING_STATUS.MASTERED
  }
  return LEARNING_STATUS.LEARNING
}

/** Pure: returns the next progress record for one answer. */
export function recordAnswer(
  progress: WordProgress,
  correct: boolean,
  answeredAt: number
): WordProgress {
  const next: WordProgress = {
    ...progress,
    seen: progress.seen + 1,
    correct: progress.correct + (correct ? 1 : 0),
    incorrect: progress.incorrect + (correct ? 0 : 1),
    streak: correct ? progress.streak + 1 : 0,
    lastSeenAt: answeredAt,
  }
  return { ...next, status: deriveStatus(next) }
}

/**
 * Difficult = explicitly flagged by the user, or answered enough times with
 * accuracy below the threshold. Explicit flags always win.
 */
export function isDifficult(progress: WordProgress): boolean {
  if (progress.markedDifficult) return true
  const attempts = progress.correct + progress.incorrect
  if (attempts < DIFFICULT_MIN_ATTEMPTS) return false
  return accuracyOf(progress) < DIFFICULT_ACCURACY_THRESHOLD
}

/** Difficult words, hardest first, then most recently missed. */
export function difficultWords(data: UserData): WordProgress[] {
  return Object.values(data.progress)
    .filter(isDifficult)
    .sort((a, b) => {
      const byAccuracy = accuracyOf(a) - accuracyOf(b)
      if (byAccuracy !== 0) return byAccuracy
      return b.lastSeenAt - a.lastSeenAt
    })
}

export type StatusCounts = {
  new: number
  learning: number
  mastered: number
  total: number
}

/**
 * Counts across a given pool of word ids. Words with no progress record count
 * as new, so the totals always add up to the pool size.
 */
export function countStatuses(
  data: UserData,
  wordIds: readonly string[]
): StatusCounts {
  const counts: StatusCounts = {
    new: 0,
    learning: 0,
    mastered: 0,
    total: wordIds.length,
  }
  for (const wordId of wordIds) {
    const status = statusOf(data, wordId)
    if (status === LEARNING_STATUS.MASTERED) counts.mastered += 1
    else if (status === LEARNING_STATUS.LEARNING) counts.learning += 1
    else counts.new += 1
  }
  return counts
}

/** Overall answer accuracy across every recorded attempt. */
export function overallAccuracy(data: UserData): number {
  let correct = 0
  let attempts = 0
  for (const progress of Object.values(data.progress)) {
    correct += progress.correct
    attempts += progress.correct + progress.incorrect
  }
  return attempts === 0 ? 0 : correct / attempts
}

/** Consecutive days, ending today or yesterday, on which a session was finished. */
export function studyStreak(data: UserData, now = Date.now()): number {
  const days = new Set(
    data.sessions.map((session) => startOfDay(session.endedAt))
  )
  if (days.size === 0) return 0

  const DAY_MS = 86_400_000
  let cursor = startOfDay(now)
  // A streak stays alive until the end of the following day.
  if (!days.has(cursor)) {
    cursor -= DAY_MS
    if (!days.has(cursor)) return 0
  }

  let streak = 0
  while (days.has(cursor)) {
    streak += 1
    cursor -= DAY_MS
  }
  return streak
}

export function startOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}
