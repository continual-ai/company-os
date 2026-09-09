import { createFileRoute } from "@tanstack/react-router"
import { Effect } from "effect"

import { applicationRuntime } from "#/app/server/application-runtime.ts"
import { Readiness } from "#/app/server/readiness.ts"

async function health(): Promise<Response> {
  return applicationRuntime.runPromise(
    Readiness.pipe(
      Effect.flatMap((readiness) => readiness.check()),
      Effect.as(Response.json({ ok: true })),
      Effect.catch(() =>
        Effect.succeed(Response.json({ ok: false }, { status: 503 }))
      )
    )
  )
}

export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: health,
    },
  },
})
