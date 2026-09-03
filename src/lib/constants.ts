/**
 * Shared named constants. Anything that is compared, branched on, or persisted
 * lives here rather than as an inline string literal.
 */

export const QUIZ_MODE = {
  MULTIPLE_CHOICE: "multiple-choice",
  FLASHCARDS: "flashcards",
  WORD_BUILDER: "word-builder",
  MEMORY_GRID: "memory-grid",
  LISTENING_QUEST: "listening-quest",
  PASSAGE_HUNT: "passage-hunt",
} as const
export type QuizMode = (typeof QUIZ_MODE)[keyof typeof QUIZ_MODE]

/** Which way round a question is asked. */
export const DIRECTION = {
  GREEK_TO_ENGLISH: "greek-to-english",
  ENGLISH_TO_GREEK: "english-to-greek",
} as const
export type Direction = (typeof DIRECTION)[keyof typeof DIRECTION]

/** How a user's relationship to a single word is classified. */
export const LEARNING_STATUS = {
  NEW: "new",
  LEARNING: "learning",
  MASTERED: "mastered",
} as const
export type LearningStatus =
  (typeof LEARNING_STATUS)[keyof typeof LEARNING_STATUS]

/** How words are chosen for a practice session. */
export const SELECTION_MODE = {
  SETS: "sets",
  RANGE: "range",
  CUSTOM: "custom",
  DIFFICULT: "difficult",
} as const
export type SelectionMode = (typeof SELECTION_MODE)[keyof typeof SELECTION_MODE]

/** Order in which questions are presented. */
export const QUESTION_ORDER = {
  SEQUENTIAL: "sequential",
  RANDOM: "random",
  ADAPTIVE: "adaptive",
} as const
export type QuestionOrder = (typeof QUESTION_ORDER)[keyof typeof QUESTION_ORDER]

/** Synchronization state shown to the user. Never claim SYNCED optimistically. */
export const SYNC_STATUS = {
  IDLE: "idle",
  SYNCING: "syncing",
  SYNCED: "synced",
  PENDING: "pending",
  OFFLINE: "offline",
  FAILED: "failed",
  SIGNED_OUT: "signed-out",
} as const
export type SyncStatus = (typeof SYNC_STATUS)[keyof typeof SYNC_STATUS]

/** Categories of failure, so the UI can say something useful. */
export const SYNC_ERROR = {
  OFFLINE: "offline",
  AUTH_EXPIRED: "auth-expired",
  PERMISSION_REVOKED: "permission-revoked",
  /** The Drive API is not enabled on the Google Cloud project. */
  API_DISABLED: "api-disabled",
  /** Signed in, but the Drive permission was not granted on the consent screen. */
  SCOPE_MISSING: "scope-missing",
  /** Transient throttling — worth retrying. */
  RATE_LIMITED: "rate-limited",
  DRIVE_UNAVAILABLE: "drive-unavailable",
  UNKNOWN: "unknown",
} as const
export type SyncErrorKind = (typeof SYNC_ERROR)[keyof typeof SYNC_ERROR]

/** localStorage keys. Namespaced so they never collide with other apps. */
export const STORAGE_KEY = {
  USER_DATA: "lexiko:user-data:v1",
  SYNC_META: "lexiko:sync-meta:v1",
  THEME: "lexiko:theme:v1",
  /** Ciphertext only — the decryption key lives in IndexedDB, not here. */
  GOOGLE_TOKEN: "lexiko:google-token:v1",
} as const

/** The single file Lexiko keeps in the user's Drive appDataFolder. */
export const DRIVE_FILE_NAME = "lexiko-learning-data.json"
export const DRIVE_APP_DATA_FOLDER = "appDataFolder"

/**
 * Minimum scope: appdata gives access only to files this app created, and
 * never exposes the rest of the user's Drive.
 */
export const GOOGLE_DRIVE_SCOPE =
  "https://www.googleapis.com/auth/drive.appdata"

/** Version of the persisted personal-data schema. Bump only with a migration. */
export const USER_DATA_SCHEMA_VERSION = 1

/** Default learning structure. The UI must never assume exactly this many. */
export const DEFAULT_SET_SIZE = 20
export const DEFAULT_QUESTION_COUNT = 20
export const MIN_QUESTION_COUNT = 5
export const MAX_QUESTION_COUNT = 100
export const MULTIPLE_CHOICE_OPTIONS = 4

/** Spare letters mixed in alongside the real ones in Word Builder. */
export const WORD_BUILDER_EXTRA_LETTERS = 6
/** Below this, spelling the word out is not an exercise (ὁ, ἐν, ἤ …). */
export const WORD_BUILDER_MIN_LETTERS = 3
/** A Memory Grid board is pairCount × 2 cards, so keep it scannable. */
export const MEMORY_GRID_MIN_PAIRS = 2
export const MEMORY_GRID_MAX_PAIRS = 8
/** Playback rates offered by Listening Quest. Order is the display order. */
export const LISTENING_REPLAY_SPEEDS = [0.75, 1, 1.25] as const
/** Greek voices are rare; this is the closest widely-shipped locale. */
export const SPEECH_LANGUAGE = "el-GR"

/**
 * Mastery rule: a word counts as mastered once it has been answered correctly
 * at least this many times, with the most recent answer correct.
 */
export const MASTERY_CORRECT_THRESHOLD = 4
/** A word becomes "difficult" once its accuracy falls below this, after enough attempts. */
export const DIFFICULT_ACCURACY_THRESHOLD = 0.6
export const DIFFICULT_MIN_ATTEMPTS = 2

export const PART_OF_SPEECH_LABEL: Record<string, string> = {
  article: "article",
  conjunction: "conjunction",
  pronoun: "pronoun",
  preposition: "preposition",
  verb: "verb",
  noun: "noun",
  adjective: "adjective",
  adverb: "adverb",
  particle: "particle",
  numeral: "numeral",
  name: "proper noun",
}
