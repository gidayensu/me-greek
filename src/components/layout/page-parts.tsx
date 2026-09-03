import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import { Card as UICard } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * The shared shadcn Card, with horizontal padding applied to the card itself
 * so page sections can pass plain children instead of CardHeader/CardContent.
 */
export function Card({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <UICard size="sm" className={cn("px-(--card-spacing)", className)}>
      {children}
    </UICard>
  )
}

export {
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function PageHeader({
  title,
  description,
  illustration,
  actions,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  /** Decorative only — always paired with real text, never carrying meaning. */
  illustration?: string
  actions?: React.ReactNode
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions}
      {illustration ? (
        <img
          src={illustration}
          alt=""
          aria-hidden="true"
          className="hidden h-24 w-auto object-contain md:block"
        />
      ) : null}
    </header>
  )
}

export function StatCard({
  icon,
  tone,
  value,
  label,
  detail,
}: {
  icon: IconSvgElement
  tone: string
  value: string
  label: string
  detail?: string
}) {
  return (
    <Card className="flex items-center gap-3">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted",
          tone
        )}
      >
        <HugeiconsIcon icon={icon} size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-sm font-medium">{label}</p>
        {detail ? (
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        ) : null}
      </div>
    </Card>
  )
}
