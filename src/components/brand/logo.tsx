import { cn } from "@/lib/utils"

export const APP_NAME = "Lexiko"
export const APP_TAGLINE = "Koine Greek vocabulary"

/**
 * The Lexiko mark: a Greek lambda (Λ, for λέξις — "word") crossed by a gold
 * bar, so it reads at once as an alpha and as a line of text on a page.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("size-9", className)}
      role="img"
      aria-label={APP_NAME}
    >
      <defs>
        <linearGradient id="lexiko-tile" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4B7BFF" />
          <stop offset="1" stopColor="#1E4FE0" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#lexiko-tile)" />
      <path
        d="M12.5 36.5 L24 12.5 L35.5 36.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="5.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17.6 28.4 H30.4"
        fill="none"
        stroke="#FBBF24"
        strokeWidth="4.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Logo({
  className,
  showTagline = false,
}: {
  className?: string
  showTagline?: boolean
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <div className="min-w-0 leading-tight">
        <div className="font-heading text-[17px] font-semibold tracking-tight">
          {APP_NAME}
        </div>
        {showTagline ? (
          <div className="truncate text-[11px] text-muted-foreground">
            {APP_TAGLINE}
          </div>
        ) : null}
      </div>
    </div>
  )
}
