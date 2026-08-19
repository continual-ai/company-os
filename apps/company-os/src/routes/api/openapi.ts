import { createFileRoute } from "@tanstack/react-router"

import { openApiDocument } from "@/server/composition-root.server"

export const Route = createFileRoute("/api/openapi")({
  server: {
    handlers: {
      GET: () => Response.json(openApiDocument),
    },
  },
})
