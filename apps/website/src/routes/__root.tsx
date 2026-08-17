import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"

import appCss from "@acme/ui/globals.css?url"

import websiteCss from "@/styles/website.css?url"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Acme" },
      {
        name: "description",
        content:
          "Acme brings customers, projects, and operational work together.",
      },
      { name: "theme-color", content: "#ffffff" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: websiteCss },
    ],
  }),
  notFoundComponent: () => (
    <main className="grid min-h-svh place-items-center px-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Page not found
        </h1>
        <a href="/" className="mt-6 inline-block text-sm font-medium underline">
          Return home
        </a>
      </div>
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
      <body className="website antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
