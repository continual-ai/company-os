import { createFileRoute } from "@tanstack/react-router"
import { Effect } from "effect"

import { ApplicationHttpServer } from "@/server/application-http-server"
import { applicationRuntime } from "@/server/application-runtime"

function handle(request: Request): Promise<Response> {
  return applicationRuntime.runPromise(
    ApplicationHttpServer.pipe(
      Effect.flatMap((server) => server.handle(request))
    )
  )
}

export const Route = createFileRoute("/api/v1/$")({
  server: {
    handlers: {
      DELETE: ({ request }) => handle(request),
      GET: ({ request }) => handle(request),
      PATCH: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
})
