import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"

import {
  appName,
  canonicalMetadata,
  documentHead,
  resolvePageMetadata,
} from "@/route-metadata"

import appCss from "@/styles/app.css?url"

const rootDocument = {
  breadcrumb: "Home",
  description:
    "Run work from shared context used by people, applications, integrations, and agents.",
  title: appName,
} as const

export const Route = createRootRoute({
  errorComponent: ({ error, reset }) => (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center p-6">
      <p className="text-sm font-medium text-destructive">Application error</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Company OS could not load this page.
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {error instanceof Error
          ? error.message
          : "An unexpected error occurred."}
      </p>
      <button
        className="mt-6 h-9 self-start border px-3 text-sm"
        onClick={reset}
      >
        Try again
      </button>
    </main>
  ),
  head: ({ matches }) => {
    const document = documentHead(resolvePageMetadata(matches) ?? rootDocument)
    const location = canonicalMetadata(matches.at(-1)?.pathname ?? "/")

    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "robots", content: "noindex, nofollow" },
        { name: "theme-color", content: "#ffffff" },
        ...document.meta,
        ...(location.meta ?? []),
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
        ...(location.links ?? []),
      ],
    }
  },
  notFoundComponent: () => (
    <main className="container mx-auto p-6 pt-16">
      <h1 className="text-2xl font-medium">Page not found</h1>
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
        {children}
        <Scripts />
      </body>
    </html>
  )
}
