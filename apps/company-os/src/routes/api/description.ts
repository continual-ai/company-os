import { createFileRoute } from "@tanstack/react-router"

import { applicationCapabilities } from "#/capabilities.ts"
import { checkCapability } from "#/server/authorization/check-capability.ts"
import { application } from "#/server/composition-root.ts"

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
