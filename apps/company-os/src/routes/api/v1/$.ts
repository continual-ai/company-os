import { createFileRoute } from "@tanstack/react-router"
import { Effect } from "effect"

import { applicationRuntime } from "@/server/application-runtime"
import { HttpTransport } from "@/server/transport/http-transport"

function handle(request: Request): Promise<Response> {
  return applicationRuntime.runPromise(
    HttpTransport.pipe(Effect.flatMap((transport) => transport.handle(request)))
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
