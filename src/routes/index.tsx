import { Link, createFileRoute } from "@tanstack/react-router"
import {
  ArrowRight01Icon,
  FireIcon,
  Idea01Icon,
  Mortarboard02Icon,
  Target01Icon,
  TrophyIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { ProgressBar } from "@/components/ui/progress-bar"
import { GreekText } from "@/components/vocabulary/word-bits"
import { Card, PageHeader, StatCard } from "@/components/layout/page-parts"
import { useAppStore } from "@/lib/state/app-store"
import {
  currentSet,
  masteredCount,
  masteredRecently,
  recommendedSets,
  todayCount,
} from "@/lib/learning/insights"
import {
  difficultWords,
  overallAccuracy,
  studyStreak,
} from "@/lib/learning/progress"
import { getWord } from "@/lib/vocabulary/vocabulary"
import { formatRelativeDay, percent } from "@/lib/format"

export const Route = createFileRoute("/")({ component: HomePage })

const DAILY_GOAL = 20

function HomePage() {
  const { data, profile, hydrated } = useAppStore()

  const current = currentSet(data)
  const studied = todayCount(data)
  const mastered = masteredCount(data)
  const streak = studyStreak(data)
  const accuracy = overallAccuracy(data)
  const difficult = difficultWords(data).slice(0, 3)
  const recommended = recommendedSets(data)
  const recent = data.sessions
    .slice()
    .sort((a, b) => b.endedAt - a.endedAt)
    .slice(0, 3)

  const firstName = profile?.name?.split(" ")[0]

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <PageHeader
        title={
          <>
            <GreekText>Χαῖρε</GreekText>
            {firstName ? `, ${firstName}` : ""}
          </>
        }
        description={
          <>
            <GreekText>Μάθε καὶ προκόπτε</GreekText> — learn and make progress.
          </>
        }
        illustration="/images/open_book.png"
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Set {current.set.index}
              </p>
              <h2 className="mt-0.5 font-heading text-xl font-semibold">
                {current.set.title}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Words {current.set.fromRank}–{current.set.toRank}
              </p>
            </div>
            <span className="text-2xl font-semibold text-primary tabular-nums">
              {percent(current.mastery)}
            </span>
          </div>
          <ProgressBar
            className="mt-4"
            value={current.mastery * 100}
            label={`${current.set.title} mastery`}
          />
          <Button
            className="mt-4"
            render={<Link to="/practice" search={{ setId: current.set.id }} />}
          >
            Continue learning
            <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
          </Button>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={Target01Icon}
              size={16}
              className="text-primary"
            />
            <h2 className="text-sm font-medium">Daily goal</h2>
          </div>
          <p className="mt-3 text-3xl font-semibold tabular-nums">
            {studied}
            <span className="text-lg font-normal text-muted-foreground">
              {" "}
              / {DAILY_GOAL}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">words studied today</p>
          <ProgressBar
            className="mt-3"
            value={Math.min(100, (studied / DAILY_GOAL) * 100)}
            label="Daily goal"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {studied >= DAILY_GOAL
              ? "Goal reached — well done."
              : "Keep going."}
          </p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={TrophyIcon}
          tone="text-warning"
          value={hydrated ? mastered.toLocaleString() : "—"}
          label="Mastered"
          detail={`+${masteredRecently(data)} this week`}
        />
        <StatCard
          icon={Target01Icon}
          tone="text-primary"
          value={hydrated ? percent(accuracy) : "—"}
          label="Accuracy"
          detail="across all answers"
        />
        <StatCard
          icon={FireIcon}
          tone="text-destructive"
          value={hydrated ? String(streak) : "—"}
          label="Day streak"
          detail={streak > 0 ? "Keep it up." : "Practise today to start one."}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="text-sm font-medium">Recommended for you</h2>
          <ul className="mt-3 flex flex-col gap-1">
            {recommended.map((entry) => (
              <li key={entry.set.id}>
                <Link
                  to="/practice"
                  search={{ setId: entry.set.id }}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <HugeiconsIcon icon={Mortarboard02Icon} size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      Set {entry.set.index} · {entry.set.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {entry.counts.mastered > 0
                        ? `${entry.counts.mastered} of ${entry.counts.total} mastered`
                        : "Not started"}
                    </span>
                  </span>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    size={15}
                    className="shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="text-sm font-medium">Difficult words</h2>
          {difficult.length === 0 ? (
            <EmptyNote>
              Nothing is giving you trouble yet. Words you miss will collect
              here.
            </EmptyNote>
          ) : (
            <>
              <ul className="mt-3 flex flex-col gap-2">
                {difficult.map((progress) => {
                  const word = getWord(progress.wordId)
                  if (!word) return null
                  return (
                    <li
                      key={progress.wordId}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <GreekText className="text-lg">{word.greek}</GreekText>
                      <span className="text-xs text-destructive">
                        missed {progress.incorrect}×
                      </span>
                    </li>
                  )
                })}
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full"
                render={<Link to="/practice" search={{ difficult: true }} />}
              >
                Review difficult words
              </Button>
            </>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-medium">Recent activity</h2>
          {recent.length === 0 ? (
            <EmptyNote>
              Your finished sessions will appear here, on this device and any
              other you sign in from.
            </EmptyNote>
          ) : (
            <ul className="mt-3 flex flex-col gap-2.5">
              {recent.map((session) => {
                const correct = session.answers.filter((a) => a.correct).length
                return (
                  <li
                    key={session.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{session.sourceLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeDay(session.endedAt)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-primary tabular-nums">
                      {session.answers.length > 0
                        ? percent(correct / session.answers.length)
                        : "—"}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4 flex items-start gap-3">
        <HugeiconsIcon
          icon={Idea01Icon}
          size={18}
          className="mt-0.5 shrink-0 text-warning"
        />
        <p className="text-sm text-muted-foreground">
          Everything works offline. Sign in with Google when you want your
          progress to follow you to another device — it is stored in your own
          Drive, in a private folder only Lexiko can see.
        </p>
      </Card>
    </div>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
      {children}
    </p>
  )
}
