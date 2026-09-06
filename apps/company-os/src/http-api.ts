import { InternalError, UnauthenticatedError } from "@company/runtime"
import { toEffectErrorSchema } from "@company/runtime/effect"
import { createModelHttpApi } from "@company/runtime/effect/http"
import {
  customMethodParameter,
  customMethodPath,
} from "@company/runtime/effect/http-custom-method"
import { Model } from "company-os/model"
import { Schema } from "effect"
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  OpenApi,
} from "effect/unstable/httpapi"

import { applicationMetadata } from "@/application-metadata"
import { isCapabilityPermission, MAX_CAPABILITY_CHECKS } from "@/capabilities"

import { eventPageSchema, InvalidEventCursor } from "./events"
import { documentIdentity } from "./openapi-identity"

const permissionSchema = Schema.String.check(
  Schema.makeFilter(isCapabilityPermission, {
    title: "Company OS permission",
  })
)

export const capabilityGroup = HttpApiGroup.make("capabilities")
  .add(
    HttpApiEndpoint.post(
      "checkCapabilities",
      customMethodPath("/api/v1/capabilities", "check"),
      {
        params: {
          check: customMethodParameter("check"),
        },
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
      }
    ).annotateMerge(
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

export const eventGroup = HttpApiGroup.make("events").add(
  HttpApiEndpoint.get("listEvents", "/api/v1/events", {
    query: Schema.Struct({
      cursor: Schema.optionalKey(Schema.String),
      type: Schema.optionalKey(Schema.String),
      pageSize: Schema.optionalKey(
        Schema.NumberFromString.check(
          Schema.isInt(),
          Schema.isBetween({ minimum: 1, maximum: 500 })
        )
      ),
    }),
    success: eventPageSchema,
    error: [
      InvalidEventCursor.pipe(HttpApiSchema.status(400)),
      toEffectErrorSchema(UnauthenticatedError).pipe(HttpApiSchema.status(401)),
      toEffectErrorSchema(InternalError).pipe(HttpApiSchema.status(500)),
    ],
  }).annotateMerge(
    OpenApi.annotations({
      identifier: "listEvents",
      summary: "Read committed events",
      description:
        "Returns authorized facts in commit order. Continue with nextCursor even after an empty page. cursor=now starts at the current head; reset requires reloading cached data. Events are retained indefinitely in this release.",
    })
  )
)

/** The one HTTP contract used by handlers, clients, OpenAPI, and documentation. */
export const applicationHttpApi = documentIdentity(
  createModelHttpApi(Model, {
    id: applicationMetadata.id,
    version: applicationMetadata.version,
  })
    .add(capabilityGroup)
    .add(eventGroup)
)
