import {
  AlertCircleIcon,
  CloudIcon,
  CloudOffIcon,
  Loading03Icon,
  Tick02Icon,
  WifiDisconnected02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { SYNC_STATUS } from "@/lib/constants"
import type { SyncStatus } from "@/lib/constants"
import { useAppStore } from "@/lib/state/app-store"
import { cn } from "@/lib/utils"

const PRESENTATION: Record<
  SyncStatus,
  { label: string; icon: typeof CloudIcon; tone: string; spin?: boolean }
> = {
  [SYNC_STATUS.SYNCED]: {
    label: "Synced",
    icon: Tick02Icon,
    tone: "text-success",
  },
  [SYNC_STATUS.SYNCING]: {
    label: "Syncing",
    icon: Loading03Icon,
    tone: "text-primary",
    spin: true,
  },
  [SYNC_STATUS.PENDING]: {
    label: "Changes waiting to sync",
    icon: CloudIcon,
    tone: "text-warning",
  },
  [SYNC_STATUS.OFFLINE]: {
    label: "Offline",
    icon: WifiDisconnected02Icon,
    tone: "text-muted-foreground",
  },
  [SYNC_STATUS.FAILED]: {
    label: "Sync failed",
    icon: AlertCircleIcon,
    tone: "text-destructive",
  },
  [SYNC_STATUS.SIGNED_OUT]: {
    label: "Saved on this device",
    icon: CloudOffIcon,
    tone: "text-muted-foreground",
  },
  [SYNC_STATUS.IDLE]: {
    label: "Saved on this device",
    icon: CloudOffIcon,
    tone: "text-muted-foreground",
  },
}

/**
 * Shows the real synchronisation state. It must never read "Synced" while
 * changes exist only in local storage.
 */
export function SyncBadge({ className }: { className?: string }) {
  const { syncStatus, syncMessage, syncNow, hydrated } = useAppStore()
  if (!hydrated) return null

  const presentation = PRESENTATION[syncStatus]
  const retryable =
    syncStatus === SYNC_STATUS.FAILED || syncStatus === SYNC_STATUS.PENDING

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <button
        type="button"
        onClick={() => void syncNow()}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs transition-colors hover:bg-muted"
        title={retryable ? "Sync now" : presentation.label}
      >
        <HugeiconsIcon
          icon={presentation.icon}
          size={14}
          className={cn(presentation.tone, presentation.spin && "animate-spin")}
        />
        <span className={cn("truncate", presentation.tone)}>
          {presentation.label}
        </span>
      </button>
      {syncMessage ? (
        <p className="px-2 text-[11px] leading-snug text-muted-foreground">
          {syncMessage}
        </p>
      ) : null}
    </div>
  )
}
