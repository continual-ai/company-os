import { createFileRoute } from "@tanstack/react-router"

import { application } from "@/server/composition-root.server"

export const Route = createFileRoute("/api/description")({
  server: {
    handlers: {
      GET: () => Response.json(application.api.description),
    },
  },
})
