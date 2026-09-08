import { applicationCapabilities } from "@company/runtime/client/capabilities"
import { createFileRoute } from "@tanstack/react-router"

import { checkCapability } from "#/server/authorization/check-capability.ts"
import { application } from "#/server/composition-root.ts"

export const Route = createFileRoute("/api/openapi")({
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
        return Response.json(application.http.document)
      },
    },
  },
})
