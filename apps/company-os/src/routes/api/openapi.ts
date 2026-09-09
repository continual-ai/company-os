import { createFileRoute } from "@tanstack/react-router"

import { checkCapability } from "#/app/server/authorization/check-capability.ts"
import { application } from "#/app/server/composition-root.ts"
import { applicationCapabilities } from "#/runtime/client/capabilities.ts"

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
