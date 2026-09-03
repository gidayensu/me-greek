import {
  DEFAULT_QUESTION_COUNT,
  DIRECTION,
  QUESTION_ORDER,
  USER_DATA_SCHEMA_VERSION,
} from "@/lib/constants"
import type {
  CustomList,
  SessionRecord,
  Settings,
  UserData,
  WordProgress,
} from "./types"

/** Sessions kept in full. Older ones are dropped so the synced file stays small. */
export const MAX_STORED_SESSIONS = 200

export function defaultSettings(now = Date.now()): Settings {
  return {
    direction: DIRECTION.GREEK_TO_ENGLISH,
    questionOrder: QUESTION_ORDER.ADAPTIVE,
    questionCount: DEFAULT_QUESTION_COUNT,
    showTransliteration: true,
    immediateFeedback: true,
    theme: "system",
    updatedAt: now,
  }
}

export function createUserData(now = Date.now()): UserData {
  return {
    schemaVersion: USER_DATA_SCHEMA_VERSION,
    profile: { createdAt: now },
    settings: defaultSettings(now),
    progress: {},
    sessions: [],
    customLists: [],
    updatedAt: now,
  }
}

/**
 * Accepts anything that was persisted by this or an earlier version and fills
 * in what is missing. Unknown fields are preserved so that data written by a
 * newer version on another device survives a round trip through this one.
 */
export function migrateUserData(raw: unknown, now = Date.now()): UserData {
  if (!raw || typeof raw !== "object") return createUserData(now)
  const input = raw as Partial<UserData> & Record<string, unknown>

  return {
    ...input,
    schemaVersion: USER_DATA_SCHEMA_VERSION,
    profile: { createdAt: now, ...(input.profile ?? {}) },
    settings: { ...defaultSettings(now), ...(input.settings ?? {}) },
    progress: isRecord(input.progress) ? input.progress : {},
    sessions: Array.isArray(input.sessions) ? input.sessions : [],
    customLists: Array.isArray(input.customLists) ? input.customLists : [],
    updatedAt: typeof input.updatedAt === "number" ? input.updatedAt : now,
  }
}

function isRecord(value: unknown): value is UserData["progress"] {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function trimSessions(sessions: SessionRecord[]): SessionRecord[] {
  return sessions
    .slice()
    .sort((a, b) => b.endedAt - a.endedAt)
    .slice(0, MAX_STORED_SESSIONS)
}

/**
 * Three-way-free merge of two independently edited copies.
 *
 * - Word progress: per word, the record with the later `lastSeenAt` wins
 *   whole. Counters are never summed, because the two copies share history and
 *   adding them would double-count every answer made before the devices
 *   diverged.
 * - Sessions and custom lists: unioned by id, so nothing a device recorded is
 *   ever dropped. Lists that exist on both sides resolve by `updatedAt`.
 * - Settings: whole-object last-write-wins on `settings.updatedAt`.
 *
 * The merge is commutative and never deletes: a word, session or list present
 * in either input is present in the output.
 */
export function mergeUserData(local: UserData, remote: UserData): UserData {
  const progress: UserData["progress"] = { ...remote.progress }
  for (const [wordId, mine] of Object.entries(local.progress)) {
    const theirs: WordProgress | undefined = progress[wordId]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- index access is unsound without noUncheckedIndexedAccess
    if (!theirs) {
      progress[wordId] = mine
      continue
    }
    if (mine.lastSeenAt > theirs.lastSeenAt) {
      progress[wordId] = mine
    } else if (
      mine.lastSeenAt === theirs.lastSeenAt &&
      mine.seen > theirs.seen
    ) {
      progress[wordId] = mine
    }
  }

  const sessions = new Map<string, SessionRecord>()
  for (const session of [...remote.sessions, ...local.sessions]) {
    sessions.set(session.id, session)
  }

  const customLists = new Map<string, CustomList>()
  for (const list of [...remote.customLists, ...local.customLists]) {
    const existing = customLists.get(list.id)
    if (!existing || list.updatedAt >= existing.updatedAt) {
      customLists.set(list.id, list)
    }
  }

  const settings =
    local.settings.updatedAt >= remote.settings.updatedAt
      ? local.settings
      : remote.settings

  return {
    schemaVersion: USER_DATA_SCHEMA_VERSION,
    profile: local.profile.email ? local.profile : remote.profile,
    settings,
    progress,
    sessions: trimSessions([...sessions.values()]),
    customLists: [...customLists.values()],
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  }
}

export function withSession(data: UserData, session: SessionRecord): UserData {
  return {
    ...data,
    sessions: trimSessions([...data.sessions, session]),
    updatedAt: session.endedAt,
  }
}
