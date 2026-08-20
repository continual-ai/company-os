import { createFileRoute } from "@tanstack/react-router"

import { companyOs } from "@/server/composition-root.server"

export const Route = createFileRoute("/api/docs")({
  server: {
    handlers: {
      GET: ({ request }) => companyOs.api.reference.handler(request),
    },
  },
})
