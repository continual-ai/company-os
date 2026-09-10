import { createFileRoute } from "@tanstack/react-router"

import { applicationRuntime } from "#/app/server/application-runtime.ts"
import { hasProjectAdmission } from "#/app/server/auth/project-admission.ts"
import { describeModel } from "#/runtime/model/index.ts"
import { activeModuleModel } from "#/runtime/platform/server/index.ts"

/** Describes the exposed model, not every composed module. */

export const Route = createFileRoute("/api/description")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await hasProjectAdmission(request.headers))) {
          return new Response(null, { status: 403 })
        }
        return Response.json(
          describeModel(
            (await applicationRuntime.runPromise(activeModuleModel())).model
          ),
          { headers: { "cache-control": "no-store" } }
        )
      },
    },
  },
})
