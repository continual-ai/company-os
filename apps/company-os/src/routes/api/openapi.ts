import { createFileRoute } from "@tanstack/react-router"

import { application } from "@/server/composition-root"

export const Route = createFileRoute("/api/openapi")({
  server: {
    handlers: {
      GET: () => Response.json(application.api.document),
    },
  },
})
