import { STORAGE_KEY } from "@/lib/constants"
import type { GoogleToken } from "./auth"

/**
 * Persists the Google access token across page reloads, encrypted at rest.
 *
 * There is no refresh token in this flow (Google Identity Services' token
 * client is implicit-grant only), so what is persisted is exactly the
 * short-lived access token GIS already issues — this only saves the round
 * trip of a silent re-grant within that token's own lifetime, typically an
 * hour. It is not a way to stay signed in indefinitely; once the token
 * expires the app falls back to the normal silent-then-interactive sign-in.
 *
 * The design splits the secret in two, in two different stores:
 *  - The AES-GCM key is generated non-extractable and kept only in
 *    IndexedDB. Non-extractable means no JavaScript in this origin — this
 *    app's own code included — can ever read the raw key bytes out; a key
 *    can only be *used* to encrypt/decrypt, never exported. That protects
 *    the token against anything that reads the browser profile at rest
 *    (a disk/backup scan, another local OS account) without running code
 *    in this page.
 *  - The ciphertext lives in localStorage, useless without the key.
 *
 * What this does NOT protect against: active script injection (XSS) into
 * this page. A script running in this origin can call the same decrypt
 * function this module exposes, exactly as legitimate code would — a
 * non-extractable key stops key *exfiltration*, not key *use*. Encryption
 * here raises the bar for offline/at-rest exposure; it is not a substitute
 * for keeping the app free of injection vulnerabilities.
 */

const DB_NAME = "lexiko-keys"
const DB_VERSION = 1
const KEY_STORE = "keys"
const KEY_RECORD_ID = "google-token-aes-key"
const AES_KEY_LENGTH = 256
const GCM_IV_BYTES = 12

function canUseSecureStorage(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.indexedDB !== "undefined" &&
    typeof window.crypto.subtle !== "undefined"
  )
}

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(KEY_STORE)) {
        request.result.createObjectStore(KEY_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function idbGet<T>(
  db: IDBDatabase,
  store: string,
  id: string
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, "readonly").objectStore(store).get(id)
    request.onsuccess = () => resolve(request.result as T | undefined)
    request.onerror = () => reject(request.error)
  })
}

function idbPut(
  db: IDBDatabase,
  store: string,
  id: string,
  value: unknown
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(store, "readwrite")
      .objectStore(store)
      .put(value, id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/** Fetches the persisted AES key, generating and storing a new one on first use. */
async function getOrCreateKey(): Promise<CryptoKey> {
  const db = await openKeyDb()
  try {
    const existing = await idbGet<CryptoKey>(db, KEY_STORE, KEY_RECORD_ID)
    if (existing) return existing

    // extractable: false — the raw bytes can never be read back out, only used.
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: AES_KEY_LENGTH },
      false,
      ["encrypt", "decrypt"]
    )
    await idbPut(db, KEY_STORE, KEY_RECORD_ID, key)
    return key
  } finally {
    db.close()
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

// Constructed from an explicit ArrayBuffer (rather than `new Uint8Array(n)`)
// so the result is typed `Uint8Array<ArrayBuffer>`, which Web Crypto's
// BufferSource parameters require.
function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

type StoredToken = {
  /** Base64-encoded AES-GCM initialization vector. */
  iv: string
  /** Base64-encoded ciphertext of the JSON-serialized GoogleToken. */
  ciphertext: string
}

/** Best-effort: persists the token, encrypted. Never throws — sync must not depend on this succeeding. */
export async function persistToken(token: GoogleToken): Promise<void> {
  if (!canUseSecureStorage()) return
  try {
    const key = await getOrCreateKey()
    const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_BYTES))
    const plaintext = new TextEncoder().encode(JSON.stringify(token))
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      plaintext
    )
    const stored: StoredToken = {
      iv: toBase64(iv),
      ciphertext: toBase64(new Uint8Array(ciphertext)),
    }
    window.localStorage.setItem(
      STORAGE_KEY.GOOGLE_TOKEN,
      JSON.stringify(stored)
    )
  } catch (error) {
    console.warn("[lexiko] could not persist the Google token", error)
  }
}

/**
 * Decrypts and returns the persisted token, or null if there is none, it
 * cannot be decrypted (a different browser profile's key, corruption), or it
 * has already expired. A null result always means "sign in as normal" —
 * never surfaced as an error.
 */
export async function restoreToken(): Promise<GoogleToken | null> {
  if (!canUseSecureStorage()) return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY.GOOGLE_TOKEN)
    if (!raw) return null
    const stored = JSON.parse(raw) as StoredToken

    const key = await getOrCreateKey()
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(stored.iv) },
      key,
      fromBase64(stored.ciphertext)
    )
    const token = JSON.parse(new TextDecoder().decode(plaintext)) as GoogleToken

    if (
      typeof token.accessToken !== "string" ||
      typeof token.expiresAt !== "number"
    ) {
      return null
    }
    if (Date.now() >= token.expiresAt) {
      // Dead credential — drop it so it is not retried every load.
      await clearPersistedToken()
      return null
    }
    return token
  } catch (error) {
    // Corrupt ciphertext, a key from a wiped/rotated store, or a disabled
    // API — all equivalent to "no persisted token" from the caller's view.
    console.warn("[lexiko] could not restore the persisted Google token", error)
    return null
  }
}

export async function clearPersistedToken(): Promise<void> {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(STORAGE_KEY.GOOGLE_TOKEN)
  } catch (error) {
    console.warn("[lexiko] could not clear the persisted Google token", error)
  }
}
