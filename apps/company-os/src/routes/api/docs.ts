import { createFileRoute } from "@tanstack/react-router"

import { application } from "@/server/composition-root"

export const Route = createFileRoute("/api/docs")({
  server: {
    handlers: {
      GET: ({ request }) => application.http.reference.handler(request),
    },
  },
})
