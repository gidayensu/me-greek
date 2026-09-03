import { useState } from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import {
  Analytics01Icon,
  Book02Icon,
  GoogleIcon,
  Home01Icon,
  Logout01Icon,
  Menu01Icon,
  Mortarboard02Icon,
  Setting07Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Logo } from "@/components/brand/logo"
import { SyncBadge } from "./sync-badge"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/lib/state/app-store"
import { cn } from "@/lib/utils"

const NAV = [
  { to: "/", label: "Home", icon: Home01Icon },
  { to: "/practice", label: "Practice", icon: Mortarboard02Icon },
  { to: "/vocabulary", label: "Vocabulary", icon: Book02Icon },
  { to: "/analytics", label: "Analytics", icon: Analytics01Icon },
  { to: "/settings", label: "Settings", icon: Setting07Icon },
] as const

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex min-h-svh bg-muted/40">
      <Sidebar
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transition-transform md:sticky md:top-0 md:h-svh md:translate-x-0",
          menuOpen ? "translate-x-0" : "-translate-x-full"
        )}
        onNavigate={() => setMenuOpen(false)}
      />
      {menuOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 bg-background/80 px-4 py-2.5 backdrop-blur md:hidden">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open navigation"
            onClick={() => setMenuOpen(true)}
          >
            <HugeiconsIcon icon={Menu01Icon} size={18} />
          </Button>
          <Logo />
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}

function Sidebar({
  className,
  onNavigate,
}: {
  className?: string
  onNavigate: () => void
}) {
  const { profile, signedIn, signIn, signOut, googleConfigured } = useAppStore()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <aside
      className={cn("flex flex-col gap-4 bg-background px-3 py-4", className)}
    >
      <Link to="/" onClick={onNavigate} className="px-2">
        <Logo showTagline />
      </Link>

      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active =
            item.to === "/" ? pathname === "/" : pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <HugeiconsIcon icon={item.icon} size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <PrivacyNote />
        <SyncBadge />
        <div className="pt-3">
          {signedIn ? (
            <div className="flex items-center gap-2 px-1">
              {profile?.pictureUrl ? (
                <img
                  src={profile.pictureUrl}
                  alt=""
                  className="size-7 shrink-0 rounded-full"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{profile?.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {profile?.email}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Sign out"
                onClick={() => void signOut()}
              >
                <HugeiconsIcon icon={Logout01Icon} size={14} />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={!googleConfigured}
              onClick={() => void signIn()}
            >
              <HugeiconsIcon icon={GoogleIcon} size={15} />
              Sign in with Google
            </Button>
          )}
        </div>
      </div>
    </aside>
  )
}

function PrivacyNote() {
  return (
    <p className="rounded-lg bg-muted/60 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
      Your progress is stored on this device and synced through{" "}
      <span className="font-medium text-foreground">your own Google Drive</span>
      . Lexiko keeps no copy.
    </p>
  )
}
