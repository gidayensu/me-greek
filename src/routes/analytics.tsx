import { useMemo } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import {
  Book02Icon,
  Clock01Icon,
  StarIcon,
  Target01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Card, PageHeader, StatCard } from "@/components/layout/page-parts"
import { GreekText } from "@/components/vocabulary/word-bits"
import {
  accuracyByDay,
  accuracyByPartOfSpeech,
  allSetProgress,
  masteredCount,
  masteredRecently,
  totalPracticeTime,
} from "@/lib/learning/insights"
import {
  accuracyOf,
  difficultWords,
  overallAccuracy,
} from "@/lib/learning/progress"
import { getWord } from "@/lib/vocabulary/vocabulary"
import { useAppStore } from "@/lib/state/app-store"
import { formatDuration, formatRelativeDay, percent } from "@/lib/format"

export const Route = createFileRoute("/analytics")({ component: AnalyticsPage })

function AnalyticsPage() {
  const { data } = useAppStore()

  const sets = useMemo(() => allSetProgress(data), [data])
  const days = useMemo(() => accuracyByDay(data, 7), [data])
  const byPos = useMemo(
    () => accuracyByPartOfSpeech(data, (id) => getWord(id)?.pos),
    [data]
  )
  const difficult = useMemo(() => difficultWords(data).slice(0, 5), [data])
  const studied = Object.keys(data.progress).length

  if (data.sessions.length === 0) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <PageHeader
          title="Learning analytics"
          description="Your progress across the vocabulary."
          illustration="/images/study.png"
        />
        <Card className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing to chart yet. Finish a practice session and your accuracy,
            mastery and study rhythm will appear here.
          </p>
          <Button className="mt-4" render={<Link to="/practice" />}>
            Start practising
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <PageHeader
        title="Learning analytics"
        description="Your progress across the vocabulary."
        illustration="/images/study.png"
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Book02Icon}
          tone="text-primary"
          value={studied.toLocaleString()}
          label="Words studied"
          detail="seen at least once"
        />
        <StatCard
          icon={StarIcon}
          tone="text-warning"
          value={masteredCount(data).toLocaleString()}
          label="Mastered"
          detail={`+${masteredRecently(data)} this week`}
        />
        <StatCard
          icon={Target01Icon}
          tone="text-success"
          value={percent(overallAccuracy(data))}
          label="Accuracy"
          detail="across all answers"
        />
        <StatCard
          icon={Clock01Icon}
          tone="text-muted-foreground"
          value={formatDuration(totalPracticeTime(data))}
          label="Practice time"
          detail={`${data.sessions.length} sessions`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-medium">Accuracy over the last 7 days</h2>
          <AccuracyChart points={days} />
        </Card>

        <Card>
          <h2 className="text-sm font-medium">Accuracy by part of speech</h2>
          {byPos.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Not enough answers yet.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {byPos.slice(0, 6).map((entry) => (
                <li key={entry.pos}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="capitalize">{entry.pos}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {percent(entry.accuracy)} · {entry.words} words
                    </span>
                  </div>
                  <Meter value={entry.accuracy} className="bg-primary" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="text-sm font-medium">Performance by set</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-lg text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="pb-2 font-medium">
                  Set
                </th>
                <th scope="col" className="pb-2 font-medium">
                  Words
                </th>
                <th scope="col" className="pb-2 font-medium">
                  Accuracy
                </th>
                <th scope="col" className="w-40 pb-2 font-medium">
                  Mastery
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sets.map((entry) => (
                <tr key={entry.set.id}>
                  <td className="py-2">
                    <span className="font-medium">Set {entry.set.index}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {entry.set.title}
                    </span>
                  </td>
                  <td className="py-2 text-muted-foreground tabular-nums">
                    {entry.counts.total}
                  </td>
                  <td className="py-2 tabular-nums">
                    {entry.accuracy === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      percent(entry.accuracy)
                    )}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <Meter
                        value={entry.mastery}
                        className="flex-1 bg-success"
                      />
                      <span className="w-9 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                        {percent(entry.mastery)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-medium">Words that need work</h2>
          {difficult.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing is consistently giving you trouble.
            </p>
          ) : (
            <>
              <ul className="mt-3 divide-y">
                {difficult.map((progress) => {
                  const word = getWord(progress.wordId)
                  if (!word) return null
                  return (
                    <li
                      key={progress.wordId}
                      className="flex items-baseline justify-between gap-3 py-2"
                    >
                      <div className="min-w-0">
                        <GreekText className="text-base">
                          {word.greek}
                        </GreekText>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {word.gloss[0]}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs text-destructive tabular-nums">
                        {percent(accuracyOf(progress))}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                render={<Link to="/practice" search={{ difficult: true }} />}
              >
                Practise these
              </Button>
            </>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-medium">Recent sessions</h2>
          <ul className="mt-3 divide-y">
            {data.sessions
              .slice()
              .sort((a, b) => b.endedAt - a.endedAt)
              .slice(0, 6)
              .map((session) => {
                const correct = session.answers.filter((a) => a.correct).length
                return (
                  <li
                    key={session.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{session.sourceLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeDay(session.endedAt)} ·{" "}
                        {formatDuration(session.endedAt - session.startedAt)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {session.answers.length > 0
                        ? percent(correct / session.answers.length)
                        : "—"}
                    </span>
                  </li>
                )
              })}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function Meter({ value, className }: { value: number; className?: string }) {
  return (
    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className={className ?? "bg-primary"}
        style={{
          width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`,
          height: "100%",
        }}
      />
    </div>
  )
}

/** A small inline bar chart. Values are also given as text for screen readers. */
function AccuracyChart({
  points,
}: {
  points: { day: number; accuracy: number | null; answers: number }[]
}) {
  return (
    <div className="mt-4">
      <div className="flex h-32 items-end gap-2">
        {points.map((point) => (
          <div
            key={point.day}
            className="flex flex-1 flex-col items-center gap-1.5"
          >
            <div className="flex w-full flex-1 items-end overflow-hidden rounded-t-md bg-muted">
              <div
                className="w-full rounded-t-md bg-primary transition-all"
                style={{ height: `${(point.accuracy ?? 0) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">
              {new Date(point.day).toLocaleDateString(undefined, {
                weekday: "narrow",
              })}
            </span>
          </div>
        ))}
      </div>
      <ul className="sr-only">
        {points.map((point) => (
          <li key={point.day}>
            {new Date(point.day).toDateString()}:{" "}
            {point.accuracy === null
              ? "no practice"
              : `${percent(point.accuracy)} across ${point.answers} answers`}
          </li>
        ))}
      </ul>
    </div>
  )
}
