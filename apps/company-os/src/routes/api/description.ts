import { createFileRoute } from "@tanstack/react-router"

import { EnabledModel } from "#/app.model.ts"
import { checkCapability } from "#/app/server/authorization/check-capability.ts"
import { applicationCapabilities } from "#/runtime/client/capabilities.ts"
import { describeModel } from "#/runtime/model/index.ts"

/** Describes the exposed model, not every composed module. */
const modelDescription = describeModel(EnabledModel)

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
        return Response.json(modelDescription)
      },
    },
  },
})
