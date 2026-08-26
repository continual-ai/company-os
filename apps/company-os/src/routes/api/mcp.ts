import { createFileRoute } from "@tanstack/react-router"
import { Effect } from "effect"

import { ApplicationMcpServer } from "@/server/application-mcp-server"
import { applicationRuntime } from "@/server/application-runtime"

function handle(request: Request): Promise<Response> {
  return applicationRuntime.runPromise(
    ApplicationMcpServer.pipe(
      Effect.flatMap((server) => server.handle(request))
    )
  )
}

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      DELETE: ({ request }) => handle(request),
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
})
