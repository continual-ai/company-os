import { createFileRoute } from "@tanstack/react-router"

import { applicationRuntime } from "#/app/server/application-runtime.ts"
import { checkCapability } from "#/app/server/authorization/check-capability.ts"
import { activeOpenApiDocument } from "#/app/server/http-api.ts"
import { activeModuleModel } from "#/modules/platform/server/index.ts"
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
        return Response.json(
          activeOpenApiDocument(
            (await applicationRuntime.runPromise(activeModuleModel())).model
          ),
          { headers: { "cache-control": "no-store" } }
        )
      },
    },
  },
})
