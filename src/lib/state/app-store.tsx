import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { SYNC_ERROR, SYNC_STATUS } from "@/lib/constants"
import type { SyncStatus } from "@/lib/constants"
import type {
  CustomList,
  SessionRecord,
  Settings,
  UserData,
  WordProgress,
} from "@/lib/learning/types"
import { createUserData } from "@/lib/learning/user-data"
import { emptyProgress } from "@/lib/learning/progress"
import {
  clearLocalData,
  loadSyncMeta,
  loadUserData,
  saveSyncMeta,
  saveUserData,
} from "@/lib/storage/local-store"
import type { SyncMeta } from "@/lib/storage/local-store"
import {
  GoogleAuthError,
  fetchProfile,
  isExpired,
  isGoogleConfigured,
  requestAccessToken,
  revokeAccess,
} from "@/lib/google/auth"
import type { GoogleProfile, GoogleToken } from "@/lib/google/auth"
import { messageFor, synchronize } from "@/lib/google/sync"

type AppState = {
  /** False until local storage has been read; the UI shows a quiet skeleton. */
  hydrated: boolean
  data: UserData
  syncStatus: SyncStatus
  syncMessage: string | null
  lastSyncedAt: number | undefined
  signedIn: boolean
  profile: GoogleProfile | null
  googleConfigured: boolean
  online: boolean

  signIn: () => Promise<void>
  signOut: (options?: { forgetLocalData?: boolean }) => Promise<void>
  syncNow: () => Promise<void>

  update: (change: (data: UserData) => UserData) => void
  saveSession: (
    session: SessionRecord,
    progress: Record<string, WordProgress>
  ) => void
  updateSettings: (patch: Partial<Settings>) => void
  toggleDifficult: (wordId: string) => void
  saveCustomList: (list: CustomList) => void
  deleteCustomList: (listId: string) => void
}

const AppStoreContext = createContext<AppState | null>(null)

export function useAppStore(): AppState {
  const store = useContext(AppStoreContext)
  if (!store)
    throw new Error("useAppStore must be used inside <AppStoreProvider>")
  return store
}

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false)
  const [data, setData] = useState<UserData>(() => createUserData())
  const [meta, setMeta] = useState<SyncMeta>({ pending: false })
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    SYNC_STATUS.SIGNED_OUT
  )
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [profile, setProfile] = useState<GoogleProfile | null>(null)
  const [online, setOnline] = useState(true)

  /** In memory only — a token is never written to storage. */
  const tokenRef = useRef<GoogleToken | null>(null)
  /** Set when a prior grant lacked Drive, so the next sign-in forces consent. */
  const needsConsentRef = useRef(false)
  /** Latest values, so callbacks can read them without re-subscribing. */
  const dataRef = useRef(data)
  const metaRef = useRef(meta)
  dataRef.current = data
  metaRef.current = meta

  const googleConfigured = isGoogleConfigured()

  // Load the local copy once, on the client.
  useEffect(() => {
    setData(loadUserData())
    setMeta(loadSyncMeta())
    setOnline(navigator.onLine)
    setHydrated(true)
  }, [])

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => {
      setOnline(false)
      setSyncStatus((current) =>
        current === SYNC_STATUS.SIGNED_OUT ? current : SYNC_STATUS.OFFLINE
      )
    }
    window.addEventListener("online", goOnline)
    window.addEventListener("offline", goOffline)
    return () => {
      window.removeEventListener("online", goOnline)
      window.removeEventListener("offline", goOffline)
    }
  }, [])

  /** Persists locally and marks the change as not yet in Drive. */
  const commit = useCallback((next: UserData) => {
    setData(next)
    dataRef.current = next
    saveUserData(next)

    const nextMeta = { ...metaRef.current, pending: true }
    setMeta(nextMeta)
    metaRef.current = nextMeta
    saveSyncMeta(nextMeta)

    // Only claim a cloud state when there is a session to sync with.
    setSyncStatus((current) =>
      current === SYNC_STATUS.SIGNED_OUT ? current : SYNC_STATUS.PENDING
    )
  }, [])

  const update = useCallback(
    (change: (current: UserData) => UserData) => {
      commit(change(dataRef.current))
    },
    [commit]
  )

  const runSync = useCallback(async () => {
    const token = tokenRef.current
    if (!token) return
    if (isExpired(token)) {
      tokenRef.current = null
      setSyncStatus(SYNC_STATUS.FAILED)
      setSyncMessage(messageFor(SYNC_ERROR.AUTH_EXPIRED))
      return
    }

    setSyncStatus(SYNC_STATUS.SYNCING)
    setSyncMessage(null)

    const outcome = await synchronize(token, dataRef.current, metaRef.current)
    if (!outcome.ok) {
      // Local data is untouched; the change stays pending and can be retried.
      setSyncStatus(
        outcome.kind === "offline" ? SYNC_STATUS.OFFLINE : SYNC_STATUS.FAILED
      )
      setSyncMessage(outcome.message)
      // Drop the token when it is the token that is wrong, so the next attempt
      // re-prompts instead of replaying a request that cannot succeed.
      if (
        outcome.kind === SYNC_ERROR.AUTH_EXPIRED ||
        outcome.kind === SYNC_ERROR.PERMISSION_REVOKED ||
        outcome.kind === SYNC_ERROR.SCOPE_MISSING
      ) {
        tokenRef.current = null
        // The Drive permission was refused, so the next sign-in must show the
        // consent screen again rather than silently reissuing the same grant.
        needsConsentRef.current = outcome.kind === SYNC_ERROR.SCOPE_MISSING
      }
      return
    }

    setData(outcome.data)
    dataRef.current = outcome.data
    saveUserData(outcome.data)
    setMeta(outcome.meta)
    metaRef.current = outcome.meta
    saveSyncMeta(outcome.meta)
    setSyncStatus(SYNC_STATUS.SYNCED)
    setSyncMessage(null)
  }, [])

  const applyToken = useCallback(
    async (token: GoogleToken) => {
      tokenRef.current = token
      // Scopes are not secret and are the single most useful thing to see when
      // sign-in succeeds but every Drive call is refused.
      console.info("[lexiko] Google granted scopes:", token.grantedScopes)
      const account: GoogleProfile = await fetchProfile(token).catch(() => ({}))
      setProfile(account)
      if (account.email) {
        const next: UserData = {
          ...dataRef.current,
          profile: { ...dataRef.current.profile, ...account },
        }
        setData(next)
        dataRef.current = next
        saveUserData(next)
      }
      await runSync()
    },
    [runSync]
  )

  const signIn = useCallback(async () => {
    if (!googleConfigured) {
      setSyncMessage(
        "Google sync is not configured for this build. Your progress is still saved on this device."
      )
      return
    }
    setSyncStatus(SYNC_STATUS.SYNCING)
    setSyncMessage(null)
    try {
      const token = await requestAccessToken({
        forceConsent: needsConsentRef.current,
      })
      needsConsentRef.current = false
      await applyToken(token)
    } catch (error) {
      setSyncStatus(SYNC_STATUS.SIGNED_OUT)
      setSyncMessage(
        error instanceof GoogleAuthError && error.kind === "cancelled"
          ? null
          : "Could not sign in with Google. Your progress is saved on this device."
      )
    }
  }, [applyToken, googleConfigured])

  // Try to pick a previous Google session back up without prompting.
  useEffect(() => {
    if (!hydrated || !googleConfigured) return
    let cancelled = false
    requestAccessToken({ silent: true })
      .then((token) => {
        if (!cancelled) return applyToken(token)
      })
      .catch(() => {
        // Expected when there is no active Google session — stay local-only.
      })
    return () => {
      cancelled = true
    }
  }, [hydrated, googleConfigured, applyToken])

  const signOut = useCallback(async ({ forgetLocalData = false } = {}) => {
    const token = tokenRef.current
    tokenRef.current = null
    if (token) await revokeAccess(token).catch(() => undefined)
    setProfile(null)
    setSyncStatus(SYNC_STATUS.SIGNED_OUT)
    setSyncMessage(null)
    if (forgetLocalData) {
      clearLocalData()
      const fresh = createUserData()
      setData(fresh)
      dataRef.current = fresh
      setMeta({ pending: false })
      metaRef.current = { pending: false }
    }
  }, [])

  const syncNow = useCallback(async () => {
    if (!tokenRef.current) {
      await signIn()
      return
    }
    await runSync()
  }, [runSync, signIn])

  const saveSession = useCallback(
    (session: SessionRecord, progress: Record<string, WordProgress>) => {
      const next: UserData = {
        ...dataRef.current,
        progress: { ...dataRef.current.progress, ...progress },
        sessions: [...dataRef.current.sessions, session],
        updatedAt: session.endedAt,
      }
      commit(next)
      // Fire and forget: a failed sync must never block finishing a session.
      void runSync()
    },
    [commit, runSync]
  )

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      update((current) => ({
        ...current,
        settings: { ...current.settings, ...patch, updatedAt: Date.now() },
        updatedAt: Date.now(),
      }))
    },
    [update]
  )

  const toggleDifficult = useCallback(
    (wordId: string) => {
      update((current) => {
        const existing = current.progress[wordId] ?? emptyProgress(wordId)
        return {
          ...current,
          progress: {
            ...current.progress,
            [wordId]: {
              ...existing,
              markedDifficult: !existing.markedDifficult,
              lastSeenAt: Date.now(),
            },
          },
          updatedAt: Date.now(),
        }
      })
    },
    [update]
  )

  const saveCustomList = useCallback(
    (list: CustomList) => {
      update((current) => ({
        ...current,
        customLists: [
          ...current.customLists.filter((l) => l.id !== list.id),
          list,
        ],
        updatedAt: Date.now(),
      }))
    },
    [update]
  )

  const deleteCustomList = useCallback(
    (listId: string) => {
      update((current) => ({
        ...current,
        customLists: current.customLists.filter((l) => l.id !== listId),
        updatedAt: Date.now(),
      }))
    },
    [update]
  )

  const value = useMemo<AppState>(
    () => ({
      hydrated,
      data,
      syncStatus,
      syncMessage,
      lastSyncedAt: meta.lastSyncedAt,
      signedIn: Boolean(profile),
      profile,
      googleConfigured,
      online,
      signIn,
      signOut,
      syncNow,
      update,
      saveSession,
      updateSettings,
      toggleDifficult,
      saveCustomList,
      deleteCustomList,
    }),
    [
      hydrated,
      data,
      syncStatus,
      syncMessage,
      meta.lastSyncedAt,
      profile,
      googleConfigured,
      online,
      signIn,
      signOut,
      syncNow,
      update,
      saveSession,
      updateSettings,
      toggleDifficult,
      saveCustomList,
      deleteCustomList,
    ]
  )

  return (
    <AppStoreContext.Provider value={value}>
      {children}
    </AppStoreContext.Provider>
  )
}
