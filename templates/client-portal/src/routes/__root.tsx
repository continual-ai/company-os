import { modelMetadata } from "@company/model/metadata"
import { initDesignMode, initTelemetry } from "@continual/sdk/app-preview"
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"
import { useEffect } from "react"

import { appMetadata } from "@/app-metadata"

import appCss from "@/styles/app.css?url"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: `${appMetadata.name} | ${modelMetadata.name}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => (
    <main className="container mx-auto p-6 pt-16">
      <h1 className="text-2xl font-medium">Page not found</h1>
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
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
