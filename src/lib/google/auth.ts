import { GOOGLE_DRIVE_SCOPE } from "@/lib/constants"

/**
 * Google sign-in via Google Identity Services, entirely in the browser.
 *
 * There is no backend, so there is no refresh token: GIS hands this page a
 * short-lived access token which is held in memory only and never written to
 * storage. On reload we try a silent re-grant; if that fails the user simply
 * signs in again, and local learning data is untouched either way.
 */

const GIS_SRC = "https://accounts.google.com/gsi/client"
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

/** Identity scopes, requested so the app can greet the user and label the account. */
const PROFILE_SCOPES = "openid email profile"
export const REQUESTED_SCOPES = `${PROFILE_SCOPES} ${GOOGLE_DRIVE_SCOPE}`

export type GoogleProfile = {
  name?: string
  email?: string
  pictureUrl?: string
}

export type GoogleToken = {
  accessToken: string
  /** Epoch ms after which the token must not be used. */
  expiresAt: number
  grantedScopes: string
}

type TokenResponse = {
  access_token?: string
  expires_in?: number
  scope?: string
  error?: string
  error_description?: string
}

type TokenClient = {
  requestAccessToken: (overrides?: { prompt?: string }) => void
}

type GoogleOAuth2 = {
  initTokenClient: (config: {
    client_id: string
    scope: string
    prompt?: string
    callback: (response: TokenResponse) => void
    error_callback?: (error: { type?: string; message?: string }) => void
  }) => TokenClient
  revoke: (token: string, done: () => void) => void
}

declare global {
  interface Window {
    /** Populated in stages as the GIS script loads, so every level is optional. */
    google?: { accounts?: { oauth2?: GoogleOAuth2 } }
  }
}

export class GoogleAuthError extends Error {
  constructor(
    message: string,
    readonly kind:
      "not-configured" | "cancelled" | "script" | "denied" | "unknown"
  ) {
    super(message)
    this.name = "GoogleAuthError"
  }
}

export function getClientId(): string | undefined {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID
  return typeof id === "string" && id.trim() ? id.trim() : undefined
}

export function isGoogleConfigured(): boolean {
  return Boolean(getClientId())
}

let scriptPromise: Promise<GoogleOAuth2> | null = null

/** Resolves with the OAuth2 namespace once the GIS script is fully loaded. */
function loadGis(): Promise<GoogleOAuth2> {
  if (typeof window === "undefined") {
    return Promise.reject(new GoogleAuthError("Not in a browser", "script"))
  }
  const ready = window.google?.accounts?.oauth2
  if (ready) return Promise.resolve(ready)
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<GoogleOAuth2>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SRC}"]`
    )
    const script = existing ?? document.createElement("script")
    const onLoad = () => {
      const oauth2 = window.google?.accounts?.oauth2
      if (oauth2) resolve(oauth2)
      else
        reject(
          new GoogleAuthError("Google sign-in failed to initialise", "script")
        )
    }
    script.addEventListener("load", onLoad, { once: true })
    script.addEventListener(
      "error",
      () =>
        reject(new GoogleAuthError("Could not reach Google sign-in", "script")),
      { once: true }
    )
    if (!existing) {
      script.src = GIS_SRC
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  }).catch((error) => {
    scriptPromise = null
    throw error
  })

  return scriptPromise
}

let tokenClient: TokenClient | null = null
let pending: {
  resolve: (token: GoogleToken) => void
  reject: (error: GoogleAuthError) => void
} | null = null

async function getTokenClient(): Promise<TokenClient> {
  const clientId = getClientId()
  if (!clientId) {
    throw new GoogleAuthError(
      "Google sign-in is not configured for this build",
      "not-configured"
    )
  }
  if (tokenClient) return tokenClient

  const oauth2 = await loadGis()
  tokenClient = oauth2.initTokenClient({
    client_id: clientId,
    scope: REQUESTED_SCOPES,
    callback: (response) => {
      const settle = pending
      pending = null
      if (!settle) return
      if (response.error || !response.access_token) {
        settle.reject(
          new GoogleAuthError(
            response.error_description ?? "Sign-in was not completed",
            response.error === "access_denied" ? "denied" : "unknown"
          )
        )
        return
      }
      settle.resolve({
        accessToken: response.access_token,
        expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
        grantedScopes: response.scope ?? "",
      })
    },
    error_callback: (error) => {
      const settle = pending
      pending = null
      settle?.reject(
        new GoogleAuthError(
          error.message ?? "Sign-in was closed",
          error.type === "popup_closed" ? "cancelled" : "unknown"
        )
      )
    },
  })
  return tokenClient
}

/**
 * Requests an access token.
 *
 * `silent` re-uses an existing Google session without showing a prompt; it
 * fails when the user must interact, which is the normal path on a fresh page
 * load. `forceConsent` re-shows the consent screen, which is the only way to
 * recover after the user declined the Drive permission — Google otherwise
 * reissues the same insufficient grant without asking again.
 */
export async function requestAccessToken({
  silent = false,
  forceConsent = false,
}: { silent?: boolean; forceConsent?: boolean } = {}): Promise<GoogleToken> {
  const client = await getTokenClient()
  if (pending) {
    throw new GoogleAuthError("A sign-in is already in progress", "unknown")
  }
  return new Promise<GoogleToken>((resolve, reject) => {
    pending = { resolve, reject }
    try {
      client.requestAccessToken({
        prompt: silent ? "none" : forceConsent ? "consent" : "",
      })
    } catch (error) {
      pending = null
      reject(
        new GoogleAuthError(
          error instanceof Error ? error.message : "Sign-in failed",
          "unknown"
        )
      )
    }
  })
}

export function hasDriveScope(token: GoogleToken): boolean {
  return token.grantedScopes.split(/\s+/).includes(GOOGLE_DRIVE_SCOPE)
}

export function isExpired(token: GoogleToken, skewMs = 60_000): boolean {
  return Date.now() + skewMs >= token.expiresAt
}

export async function fetchProfile(token: GoogleToken): Promise<GoogleProfile> {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  })
  if (!response.ok) return {}
  const body = (await response.json()) as {
    name?: string
    email?: string
    picture?: string
  }
  return { name: body.name, email: body.email, pictureUrl: body.picture }
}

/** Revokes the grant so the user can disconnect the app from their account. */
export async function revokeAccess(token: GoogleToken): Promise<void> {
  const oauth2 = await loadGis()
  await new Promise<void>((resolve) => {
    oauth2.revoke(token.accessToken, resolve)
  })
}
