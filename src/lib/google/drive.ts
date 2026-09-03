import {
  DRIVE_APP_DATA_FOLDER,
  DRIVE_FILE_NAME,
  SYNC_ERROR,
} from "@/lib/constants"
import type { SyncErrorKind } from "@/lib/constants"
import type { UserData } from "@/lib/learning/types"
import { migrateUserData } from "@/lib/learning/user-data"
import type { GoogleToken } from "./auth"

/**
 * Reads and writes the single JSON document Lexiko keeps in the user's Drive
 * appDataFolder — a private area that only this app can see and that never
 * exposes the rest of their Drive.
 *
 * Nothing above this module knows about Drive's REST shape.
 */

const FILES_URL = "https://www.googleapis.com/drive/v3/files"
const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files"

export class DriveError extends Error {
  constructor(
    message: string,
    readonly kind: SyncErrorKind
  ) {
    super(message)
    this.name = "DriveError"
  }
}

/** The shape Drive returns on failure. Every field is best-effort. */
type DriveErrorBody = {
  error?: {
    code?: number
    message?: string
    status?: string
    errors?: { reason?: string; message?: string }[]
  }
}

/**
 * A 403 from Drive means several very different things, and telling the user
 * "you revoked access" when the API is simply switched off sends them looking
 * in the wrong place. Classify on the reason Google gives, not the status.
 */
function classify(status: number, reason: string | undefined): SyncErrorKind {
  if (status === 401) return SYNC_ERROR.AUTH_EXPIRED

  if (status === 403) {
    switch (reason) {
      case "accessNotConfigured":
      case "forbidden":
        return SYNC_ERROR.API_DISABLED
      case "insufficientPermissions":
      case "insufficientFilePermissions":
      case "appNotAuthorizedToFile":
        return SYNC_ERROR.SCOPE_MISSING
      case "rateLimitExceeded":
      case "userRateLimitExceeded":
      case "dailyLimitExceeded":
      case "sharingRateLimitExceeded":
        return SYNC_ERROR.RATE_LIMITED
      default:
        return SYNC_ERROR.PERMISSION_REVOKED
    }
  }

  if (status === 404) return SYNC_ERROR.UNKNOWN
  if (status === 429) return SYNC_ERROR.RATE_LIMITED
  if (status >= 500) return SYNC_ERROR.DRIVE_UNAVAILABLE
  return SYNC_ERROR.UNKNOWN
}

async function call(
  url: string,
  token: GoogleToken,
  init: RequestInit = {}
): Promise<Response> {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${token.accessToken}`,
      },
    })
  } catch {
    // fetch only rejects on a network-level failure.
    throw new DriveError("Could not reach Google Drive", SYNC_ERROR.OFFLINE)
  }
  if (!response.ok) {
    // Read Drive's own explanation before deciding what went wrong. The body
    // carries no user content, so it is safe to log; the token never is.
    let body: DriveErrorBody = {}
    try {
      body = (await response.clone().json()) as DriveErrorBody
    } catch {
      // Non-JSON error page (a proxy or an outage); fall back to the status.
    }
    const reason = body.error?.errors?.[0]?.reason
    const detail = body.error?.message ?? response.statusText

    console.error(
      `[lexiko] Google Drive ${response.status}` +
        `${reason ? ` (${reason})` : ""}: ${detail}`
    )

    throw new DriveError(
      `Google Drive request failed (${response.status})`,
      classify(response.status, reason)
    )
  }
  return response
}

export type DriveFile = {
  id: string
  /** Drive's change marker; changes whenever the file content changes. */
  version: string
  modifiedTime: string
}

/** Finds the app's data file, or undefined if this account has none yet. */
export async function findDataFile(
  token: GoogleToken
): Promise<DriveFile | undefined> {
  const params = new URLSearchParams({
    spaces: DRIVE_APP_DATA_FOLDER,
    q: `name = '${DRIVE_FILE_NAME}' and trashed = false`,
    fields: "files(id,version,modifiedTime)",
    pageSize: "10",
  })
  const response = await call(`${FILES_URL}?${params}`, token)
  const body = (await response.json()) as { files?: DriveFile[] }
  return body.files?.[0]
}

export async function downloadDataFile(
  token: GoogleToken,
  fileId: string
): Promise<UserData> {
  const response = await call(`${FILES_URL}/${fileId}?alt=media`, token)
  const raw = (await response.json()) as unknown
  return migrateUserData(raw)
}

/** Creates the file on first sync and returns its new id. */
export async function createDataFile(
  token: GoogleToken,
  data: UserData
): Promise<DriveFile> {
  const boundary = `lexiko-${crypto.randomUUID()}`
  const metadata = {
    name: DRIVE_FILE_NAME,
    parents: [DRIVE_APP_DATA_FOLDER],
    mimeType: "application/json",
  }
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(data)}\r\n` +
    `--${boundary}--`

  const response = await call(
    `${UPLOAD_URL}?uploadType=multipart&fields=id,version,modifiedTime`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    }
  )
  return (await response.json()) as DriveFile
}

export async function updateDataFile(
  token: GoogleToken,
  fileId: string,
  data: UserData
): Promise<DriveFile> {
  const response = await call(
    `${UPLOAD_URL}/${fileId}?uploadType=media&fields=id,version,modifiedTime`,
    token,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  )
  return (await response.json()) as DriveFile
}

/** Cheap check for whether the remote copy moved since we last saw it. */
export async function getFileVersion(
  token: GoogleToken,
  fileId: string
): Promise<DriveFile> {
  const response = await call(
    `${FILES_URL}/${fileId}?fields=id,version,modifiedTime`,
    token
  )
  return (await response.json()) as DriveFile
}
