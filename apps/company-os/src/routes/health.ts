import { createFileRoute } from "@tanstack/react-router"
import { Effect } from "effect"

import { applicationRuntime } from "@/server/application-runtime"
import { Readiness } from "@/server/readiness"

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
