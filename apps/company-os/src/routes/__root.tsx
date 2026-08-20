import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"

import {
  canonicalMetadata,
  documentHead,
  resolvePageMetadata,
} from "@/route-metadata"

import appCss from "@/styles/app.css?url"

const rootDocument = {
  breadcrumb: "Home",
  description:
    "Run Acme's work from shared business context used by people, applications, integrations, and agents.",
  title: "Acme Company OS",
} as const

export const Route = createRootRoute({
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
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
        { rel: "manifest", href: "/site.webmanifest" },
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
