import { STORAGE_KEY } from "@/lib/constants"
import type { UserData } from "@/lib/learning/types"
import { createUserData, migrateUserData } from "@/lib/learning/user-data"

/**
 * Local-first persistence. This is the source of truth while the app runs;
 * Google Drive is a replica of it, never the other way round.
 *
 * Everything here is a no-op during server rendering.
 */

export type SyncMeta = {
  /** Drive file id, cached so we do not search the appDataFolder every time. */
  fileId?: string
  /** The `updatedAt` of the data we last confirmed reached Drive. */
  lastSyncedAt?: number
  /** Drive's own version marker, used to detect a remote change. */
  lastSyncedRevision?: string
  /** True when local data has changed since the last confirmed upload. */
  pending: boolean
}

const canUseStorage = () =>
  typeof window !== "undefined" && Boolean(window.localStorage)

function readJson<T>(key: string): T | null {
  if (!canUseStorage()) return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch (error) {
    console.warn(`[lexiko] could not read ${key} from local storage`, error)
    return null
  }
}

function writeJson(key: string, value: unknown): boolean {
  if (!canUseStorage()) return false
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (error) {
    // Quota exceeded, or storage disabled. The caller keeps the in-memory copy.
    console.error(`[lexiko] could not save ${key} to local storage`, error)
    return false
  }
}

export function loadUserData(): UserData {
  const stored = readJson<unknown>(STORAGE_KEY.USER_DATA)
  return stored ? migrateUserData(stored) : createUserData()
}

export function saveUserData(data: UserData): boolean {
  return writeJson(STORAGE_KEY.USER_DATA, data)
}

export function loadSyncMeta(): SyncMeta {
  return readJson<SyncMeta>(STORAGE_KEY.SYNC_META) ?? { pending: false }
}

export function saveSyncMeta(meta: SyncMeta): boolean {
  return writeJson(STORAGE_KEY.SYNC_META, meta)
}

/** Used when the user signs out and asks for their local copy to be cleared. */
export function clearLocalData(): void {
  if (!canUseStorage()) return
  window.localStorage.removeItem(STORAGE_KEY.USER_DATA)
  window.localStorage.removeItem(STORAGE_KEY.SYNC_META)
}
