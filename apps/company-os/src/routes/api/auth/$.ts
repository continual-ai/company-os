import { createFileRoute } from "@tanstack/react-router"
import { Effect } from "effect"

import { applicationRuntime } from "@/server/application-runtime"
import { AuthProtocol } from "@/server/auth/auth-protocol"

async function handle(request: Request): Promise<Response> {
  return applicationRuntime.runPromise(
    AuthProtocol.pipe(Effect.flatMap((auth) => auth.handle(request)))
  )
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
})
