import { createFileRoute } from "@tanstack/react-router"

import { applicationRuntime } from "#/app/server/application-runtime.ts"
import { hasProjectAdmission } from "#/app/server/auth/project-admission.ts"
import { activeOpenApiDocument } from "#/app/server/http-api.ts"
import { activeModuleModel } from "#/runtime/platform/server/index.ts"

export const Route = createFileRoute("/api/openapi")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await hasProjectAdmission(request.headers))) {
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
