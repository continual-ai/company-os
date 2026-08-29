import { createFileRoute } from "@tanstack/react-router"

import { applicationCapabilities } from "@/capabilities"
import { checkCapability } from "@/server/authorization/check-capability"
import { application } from "@/server/composition-root"

export const Route = createFileRoute("/api/description")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (
          !(await checkCapability(
            request.headers,
            applicationCapabilities.develop
          ))
        ) {
          return new Response(null, { status: 403 })
        }
        return Response.json(application.model.description)
      },
    },
  },
})
