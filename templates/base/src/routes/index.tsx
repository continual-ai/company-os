import { modelMetadata } from "@company/model/metadata"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({ component: Home })

function Home() {
  return (
    <main className="grid min-h-svh place-items-center px-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-muted-foreground">
          {modelMetadata.name}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          A new company application
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Replace this page with the app&apos;s first real surface. Durable
          records, rules, and authorization stay in the central Company OS
          application.
        </p>
      </div>
    </main>
  )
}
