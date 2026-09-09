import { createFileRoute } from "@tanstack/react-router"

import { checkCapability } from "#/app/server/authorization/check-capability.ts"
import { openApiDocument } from "#/app/server/http-api.ts"
import { applicationCapabilities } from "#/runtime/contract/capabilities.ts"

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
        return Response.json(openApiDocument)
      },
    },
  },
})
