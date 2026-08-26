import { createFileRoute } from "@tanstack/react-router"
import { Effect } from "effect"

import { applicationRuntime } from "@/server/application-runtime"
import { McpTransport } from "@/server/transport/mcp-transport"

function handle(request: Request): Promise<Response> {
  return applicationRuntime.runPromise(
    McpTransport.pipe(Effect.flatMap((transport) => transport.handle(request)))
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
