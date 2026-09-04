import { modelMetadata } from "@company/model/metadata"
import { buttonVariants } from "@company/ui/components/button"
import { initDesignMode, initTelemetry } from "@continual/sdk/app-preview"
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"
import { useEffect } from "react"

import appCss from "@/styles/app.css?url"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: modelMetadata.name },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => (
    <main className="grid min-h-svh place-items-center px-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Page not found
        </h1>
        <a
          href="/"
          className={buttonVariants({ className: "mt-6", variant: "link" })}
        >
          Return home
        </a>
      </div>
    </main>
  ),
  shellComponent: RootDocument,
})

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
      <body className="antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
