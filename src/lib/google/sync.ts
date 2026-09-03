import { SYNC_ERROR } from "@/lib/constants"
import type { SyncErrorKind } from "@/lib/constants"
import type { UserData } from "@/lib/learning/types"
import { mergeUserData } from "@/lib/learning/user-data"
import type { SyncMeta } from "@/lib/storage/local-store"
import { hasDriveScope, type GoogleToken } from "./auth"
import {
  DriveError,
  createDataFile,
  downloadDataFile,
  findDataFile,
  updateDataFile,
} from "./drive"

/**
 * One synchronisation pass: pull what Drive has, merge it with the local copy,
 * push the result back.
 *
 * The merge always runs before the upload, so a second device's progress is
 * never overwritten — even when this device has been offline for a while.
 * A failure at any point leaves local data exactly as it was and reports the
 * change as still pending.
 */

export type SyncOutcome =
  | { ok: true; data: UserData; meta: SyncMeta; pulledRemote: boolean }
  | { ok: false; kind: SyncErrorKind; message: string }

export async function synchronize(
  token: GoogleToken,
  local: UserData,
  meta: SyncMeta
): Promise<SyncOutcome> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      ok: false,
      kind: SYNC_ERROR.OFFLINE,
      message: messageFor(SYNC_ERROR.OFFLINE),
    }
  }

  // Google can hand back a valid token while the user declined the Drive
  // permission on the consent screen. Catch that here rather than letting every
  // request 403 and reporting it as a revoked grant.
  if (!hasDriveScope(token)) {
    return {
      ok: false,
      kind: SYNC_ERROR.SCOPE_MISSING,
      message: messageFor(SYNC_ERROR.SCOPE_MISSING),
    }
  }

  try {
    const existing = meta.fileId
      ? { id: meta.fileId }
      : await findDataFile(token)

    if (!existing) {
      const created = await createDataFile(token, local)
      return {
        ok: true,
        pulledRemote: false,
        data: local,
        meta: {
          fileId: created.id,
          lastSyncedAt: local.updatedAt,
          lastSyncedRevision: created.version,
          pending: false,
        },
      }
    }

    const remote = await downloadDataFile(token, existing.id)
    const merged = mergeUserData(local, remote)
    const saved = await updateDataFile(token, existing.id, merged)

    return {
      ok: true,
      pulledRemote: true,
      data: merged,
      meta: {
        fileId: saved.id,
        lastSyncedAt: merged.updatedAt,
        lastSyncedRevision: saved.version,
        pending: false,
      },
    }
  } catch (error) {
    if (error instanceof DriveError) {
      return { ok: false, kind: error.kind, message: messageFor(error.kind) }
    }
    console.error("[lexiko] unexpected synchronisation failure", error)
    return {
      ok: false,
      kind: SYNC_ERROR.UNKNOWN,
      message: messageFor(SYNC_ERROR.UNKNOWN),
    }
  }
}

/** Technical failures become something a learner can act on. */
export function messageFor(kind: SyncErrorKind): string {
  switch (kind) {
    case SYNC_ERROR.OFFLINE:
      return "You're offline. Your progress will sync when you reconnect."
    case SYNC_ERROR.AUTH_EXPIRED:
      return "Your Google session expired. Sign in again to resume syncing."
    case SYNC_ERROR.PERMISSION_REVOKED:
      return "Lexiko no longer has access to your Google Drive. Sign in again to restore syncing."
    case SYNC_ERROR.API_DISABLED:
      return "Google Drive is not enabled for this app yet. Your progress is safe on this device."
    case SYNC_ERROR.SCOPE_MISSING:
      return "Lexiko needs permission to use its own folder in your Google Drive. Sign in again and allow Drive access."
    case SYNC_ERROR.RATE_LIMITED:
      return "Google Drive is busy right now. Your changes are saved on this device and will be retried."
    case SYNC_ERROR.DRIVE_UNAVAILABLE:
      return "Google Drive is temporarily unavailable. Your changes are saved on this device."
    case SYNC_ERROR.UNKNOWN:
      return "Sync failed. Your changes are saved on this device and will be retried."
  }
}
