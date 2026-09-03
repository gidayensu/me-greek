import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  GoogleDriveIcon,
  GoogleIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Card, PageHeader } from "@/components/layout/page-parts"
import {
  DIRECTION,
  MAX_QUESTION_COUNT,
  MIN_QUESTION_COUNT,
  QUESTION_ORDER,
} from "@/lib/constants"
import type { Direction, QuestionOrder } from "@/lib/constants"
import { useAppStore } from "@/lib/state/app-store"
import { formatRelativeDay } from "@/lib/format"

export const Route = createFileRoute("/settings")({ component: SettingsPage })

function SettingsPage() {
  const {
    data,
    updateSettings,
    signedIn,
    signIn,
    signOut,
    syncNow,
    googleConfigured,
    lastSyncedAt,
    profile,
  } = useAppStore()
  const [confirmingForget, setConfirmingForget] = useState(false)
  const settings = data.settings

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <PageHeader
        title="Settings"
        description="Practice defaults and where your data lives."
      />

      <Card className="mt-5">
        <h2 className="font-heading text-base font-semibold">
          Practice defaults
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Starting values for a new session. You can change them per session
          too.
        </p>

        <div className="mt-4 flex flex-col gap-5">
          <Field label="Direction">
            <SegmentedControl
              label="Default direction"
              value={settings.direction}
              onValueChange={(value) =>
                updateSettings({ direction: value as Direction })
              }
              options={[
                { value: DIRECTION.GREEK_TO_ENGLISH, label: "Greek → English" },
                { value: DIRECTION.ENGLISH_TO_GREEK, label: "English → Greek" },
              ]}
            />
          </Field>

          <Field label="Question order">
            <SegmentedControl
              label="Default question order"
              value={settings.questionOrder}
              onValueChange={(value) =>
                updateSettings({ questionOrder: value as QuestionOrder })
              }
              options={[
                { value: QUESTION_ORDER.ADAPTIVE, label: "Adaptive" },
                { value: QUESTION_ORDER.RANDOM, label: "Random" },
                { value: QUESTION_ORDER.SEQUENTIAL, label: "By frequency" },
              ]}
            />
          </Field>

          <Field label="Questions per session">
            <input
              type="range"
              min={MIN_QUESTION_COUNT}
              max={MAX_QUESTION_COUNT}
              step={5}
              value={settings.questionCount}
              onChange={(event) =>
                updateSettings({ questionCount: Number(event.target.value) })
              }
              className="w-full accent-primary"
              aria-label="Questions per session"
            />
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              {settings.questionCount} questions
            </p>
          </Field>

          <Toggle
            label="Show transliteration"
            description="Display the Latin-letter reading alongside the Greek."
            checked={settings.showTransliteration}
            onChange={(showTransliteration) =>
              updateSettings({ showTransliteration })
            }
          />

          <Toggle
            label="Immediate feedback"
            description="Show whether an answer was right before moving on."
            checked={settings.immediateFeedback}
            onChange={(immediateFeedback) =>
              updateSettings({ immediateFeedback })
            }
          />
        </div>
      </Card>

      <Card className="mt-4">
        <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
          <HugeiconsIcon
            icon={GoogleDriveIcon}
            size={18}
            className="text-primary"
          />
          Your data
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Lexiko has no server. Your progress is saved on this device and, when
          you sign in, copied to a private folder in your own Google Drive that
          only this app can read. Nothing is stored anywhere else, and you can
          revoke access at any time.
        </p>

        {!googleConfigured ? (
          <p className="mt-3 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            Google sync is not configured for this build. Set{" "}
            <code className="font-mono">VITE_GOOGLE_CLIENT_ID</code> to enable
            it. Practice and local saving work regardless.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {signedIn ? (
            <>
              <Button variant="outline" onClick={() => void syncNow()}>
                <HugeiconsIcon icon={RefreshIcon} size={16} />
                Sync now
              </Button>
              <Button variant="ghost" onClick={() => void signOut()}>
                Disconnect Google
              </Button>
            </>
          ) : (
            <Button onClick={() => void signIn()} disabled={!googleConfigured}>
              <HugeiconsIcon icon={GoogleIcon} size={16} />
              Sign in with Google
            </Button>
          )}
        </div>

        {signedIn && profile?.email ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Connected as {profile.email}
            {lastSyncedAt
              ? ` · last synced ${formatRelativeDay(lastSyncedAt).toLowerCase()}`
              : ""}
          </p>
        ) : null}
      </Card>

      <Card className="mt-4">
        <h2 className="font-heading text-base font-semibold">
          Remove data from this device
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Clears the local copy of your progress. Anything already synced stays
          in your Google Drive and comes back when you sign in again.
        </p>
        {confirmingForget ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="destructive"
              onClick={() => {
                void signOut({ forgetLocalData: true })
                setConfirmingForget(false)
              }}
            >
              Yes, clear this device
            </Button>
            <Button variant="ghost" onClick={() => setConfirmingForget(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="destructive"
            className="mt-3"
            onClick={() => setConfirmingForget(true)}
          >
            Clear local data
          </Button>
        )}
      </Card>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      {children}
    </div>
  )
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  )
}
