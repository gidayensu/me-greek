import type {
  Direction,
  LearningStatus,
  QuestionOrder,
  QuizMode,
  SELECTION_MODE,
} from "@/lib/constants"

/** What the user knows about one word. The unit of merge during sync. */
export type WordProgress = {
  wordId: string
  seen: number
  correct: number
  incorrect: number
  status: LearningStatus
  /** Consecutive correct answers; resets to 0 on a wrong answer. */
  streak: number
  /** Epoch ms of the most recent answer. Drives conflict resolution. */
  lastSeenAt: number
  /** Set by the user explicitly, independently of accuracy. */
  markedDifficult?: boolean
}

export type AnswerRecord = {
  wordId: string
  correct: boolean
  /** What the user chose. Absent for flashcard self-assessment. */
  answered?: string
  answeredAt: number
}

export type SessionRecord = {
  id: string
  mode: QuizMode
  direction: Direction
  startedAt: number
  endedAt: number
  wordIds: string[]
  answers: AnswerRecord[]
  newlyMastered: string[]
  /** Human label for where the words came from, e.g. "Set 1, Set 2". */
  sourceLabel: string
}

export type CustomList = {
  id: string
  name: string
  wordIds: string[]
  createdAt: number
  updatedAt: number
}

export type Settings = {
  direction: Direction
  questionOrder: QuestionOrder
  questionCount: number
  showTransliteration: boolean
  immediateFeedback: boolean
  theme: "light" | "dark" | "system"
  /** Epoch ms; whole-object last-write-wins during sync. */
  updatedAt: number
}

export type Profile = {
  /** Google account display name, cached so the UI works offline. */
  name?: string
  email?: string
  pictureUrl?: string
  createdAt: number
}

/** Everything personal to the user. Saved locally, synced to their Drive. */
export type UserData = {
  schemaVersion: number
  profile: Profile
  settings: Settings
  progress: Record<string, WordProgress>
  sessions: SessionRecord[]
  customLists: CustomList[]
  /** Epoch ms of the last local change. */
  updatedAt: number
}

/** How a practice session's words were chosen. */
export type SelectionSpec =
  | { mode: typeof SELECTION_MODE.SETS; setIds: string[] }
  | { mode: typeof SELECTION_MODE.RANGE; fromRank: number; toRank: number }
  | { mode: typeof SELECTION_MODE.CUSTOM; wordIds: string[] }
  | { mode: typeof SELECTION_MODE.DIFFICULT; limit: number }

/** Which learning statuses a selection is allowed to include. */
export type StatusFilter = {
  includeNew: boolean
  includeLearning: boolean
  includeMastered: boolean
}

/** Everything needed to build a session, gathered by the practice wizard. */
export type PracticeConfig = {
  selection: SelectionSpec
  statusFilter: StatusFilter
  mode: QuizMode
  direction: Direction
  questionOrder: QuestionOrder
  questionCount: number
}
