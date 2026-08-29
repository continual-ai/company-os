import { Model } from "@company/model"
import { InternalError, UnauthenticatedError } from "@company/runtime"
import { toEffectErrorSchema } from "@company/runtime/effect"
import { createModelHttpApi } from "@company/runtime/effect/http"
import { Schema } from "effect"
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  OpenApi,
} from "effect/unstable/httpapi"

import { applicationMetadata } from "@/application-metadata"
import { isCapabilityPermission, MAX_CAPABILITY_CHECKS } from "@/capabilities"

const permissionSchema = Schema.String.check(
  Schema.makeFilter(isCapabilityPermission, {
    title: "Company OS permission",
  })
)

export const capabilityGroup = HttpApiGroup.make("capabilities")
  .add(
    HttpApiEndpoint.post("checkCapabilities", "/api/v1/capabilities:check", {
      payload: Schema.Struct({
        checks: Schema.Array(
          Schema.Struct({
            permission: permissionSchema,
            target: Schema.optionalKey(
              Schema.String.check(Schema.isMinLength(1))
            ),
          })
        ).check(
          Schema.isMinLength(1),
          Schema.isMaxLength(MAX_CAPABILITY_CHECKS)
        ),
      }),
      success: Schema.Struct({
        results: Schema.Array(Schema.Struct({ allowed: Schema.Boolean })),
      }),
      error: [
        toEffectErrorSchema(UnauthenticatedError).pipe(
          HttpApiSchema.status(401)
        ),
        toEffectErrorSchema(InternalError).pipe(HttpApiSchema.status(500)),
      ],
    }).annotateMerge(
      OpenApi.annotations({
        description:
          "Evaluates application permissions for the caller. Results are advisory; every operation enforces authorization again.",
        identifier: "checkCapabilities",
        summary: "Check capabilities",
      })
    )
  )
  .annotateMerge(
    OpenApi.annotations({
      description: "Authorization decisions for conditional client behavior.",
      title: "Capabilities",
    })
  )

/** The one HTTP contract used by handlers, clients, OpenAPI, and documentation. */
export const applicationHttpApi = createModelHttpApi(Model, {
  id: applicationMetadata.id,
  version: applicationMetadata.version,
}).add(capabilityGroup)
