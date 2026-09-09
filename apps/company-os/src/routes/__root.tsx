import { initDesignMode, initTelemetry } from "@continual/sdk/app-preview"
import type { QueryClient } from "@tanstack/react-query"
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router"
import { useEffect } from "react"

import { appConfig } from "#/app/customization/config.ts"
import {
  appName,
  canonicalMetadata,
  documentHead,
  resolvePageMetadata,
} from "#/app/route-metadata.ts"

import appCss from "#/app/styles/app.css?url"

const rootDocument = {
  breadcrumb: "Home",
  description:
    "Run work from shared context used by people, applications, integrations, and agents.",
  title: appName,
} as const

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    errorComponent: ({ error, reset }) => (
      <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center p-6">
        <p className="text-sm font-medium text-destructive">
          Application error
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {appConfig.identity.name} could not load this page.
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
      const document = documentHead(
        resolvePageMetadata(matches) ?? rootDocument
      )
      const location = canonicalMetadata(matches.at(-1)?.pathname ?? "/")

      return {
        meta: [
          { charSet: "utf-8" },
          { name: "viewport", content: "width=device-width, initial-scale=1" },
          { name: "robots", content: "noindex, nofollow" },
          { name: "theme-color", content: appConfig.brand.themeColor },
          ...document.meta,
          ...(location.meta ?? []),
        ],
        links: [
          { rel: "stylesheet", href: appCss },
          {
            rel: "icon",
            href: appConfig.brand.favicon.href,
            type: appConfig.brand.favicon.type,
          },
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
  }
)

function RootDocument({ children }: { children: React.ReactNode }) {
  // Hosted previews drive design feedback and telemetry through these hooks;
  // outside a preview they observe nothing and send nothing.
  useEffect(() => {
    initDesignMode()
    initTelemetry()
  }, [])

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
