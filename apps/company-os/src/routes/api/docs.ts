import { createFileRoute } from "@tanstack/react-router"

import { apiReference } from "@/server/composition-root.server"

export const Route = createFileRoute("/api/docs")({
  server: {
    handlers: {
      GET: ({ request }) => apiReference.handler(request),
    },
  },
})
