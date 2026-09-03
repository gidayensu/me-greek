import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"

import { AppShell } from "@/components/layout/app-shell"
import { AppStoreProvider } from "@/lib/state/app-store"
import appCss from "../styles.css?url"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lexiko — Learn Koine Greek vocabulary" },
      {
        name: "description",
        content:
          "Learn New Testament Greek vocabulary with quizzes and flashcards. Works offline; your progress syncs through your own Google Drive.",
      },
      { name: "theme-color", content: "#2450D8" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/logo.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/logo.svg" },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),
  notFoundComponent: () => (
    <main className="mx-auto max-w-md p-8 pt-20 text-center">
      <h1 className="font-heading text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        That page does not exist. Try the navigation on the left.
      </p>
    </main>
  ),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <AppStoreProvider>
          <AppShell>{children}</AppShell>
        </AppStoreProvider>
        <TanStackDevtools
          config={{ position: "bottom-right" }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
