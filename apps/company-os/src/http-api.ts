import { InternalError, UnauthenticatedError } from "@company/runtime"
import { toEffectErrorSchema } from "@company/runtime/effect"
import { createModelHttpApi } from "@company/runtime/effect/http"
import {
  customMethodParameter,
  customMethodPath,
} from "@company/runtime/effect/http-custom-method"
import { Schema } from "effect"
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  OpenApi,
} from "effect/unstable/httpapi"

import { appMetadata } from "#/app-metadata.ts"
import { Model } from "#/app.model.ts"
import {
  isCapabilityPermission,
  MAX_CAPABILITY_CHECKS,
} from "#/capabilities.ts"
import { eventPageSchema, InvalidEventCursor } from "#/events.ts"
import { documentIdentity } from "#/openapi-identity.ts"
import { recordSearchInput, recordSearchResult } from "#/records.ts"

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

const eventStreamSchema = HttpApiSchema.StreamSse({
  events: Schema.Struct({
    id: Schema.UndefinedOr(Schema.String),
    event: Schema.Literal("page"),
    data: Schema.fromJsonString(eventPageSchema),
  }),
  error: InvalidEventCursor,
})

export const eventGroup = HttpApiGroup.make("events")
  .add(
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
        toEffectErrorSchema(UnauthenticatedError).pipe(
          HttpApiSchema.status(401)
        ),
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
  .add(
    HttpApiEndpoint.get(
      "streamEvents",
      customMethodPath("/api/v1/events", "stream"),
      {
        params: { stream: customMethodParameter("stream") },
        query: Schema.Struct({ cursor: Schema.optionalKey(Schema.String) }),
        success: eventStreamSchema,
        error: [
          toEffectErrorSchema(UnauthenticatedError).pipe(
            HttpApiSchema.status(401)
          ),
          toEffectErrorSchema(InternalError).pipe(HttpApiSchema.status(500)),
        ],
      }
    ).annotateMerge(
      OpenApi.annotations({
        summary: "Subscribe to committed events",
        description:
          "Authorized SSE pages. Resume using the last successfully applied nextCursor. Connections end after 60 seconds to renew authentication; access is checked on every page, including idle checkpoints.",
      })
    )
  )

export const recordGroup = HttpApiGroup.make("records").add(
  HttpApiEndpoint.post(
    "searchRecords",
    customMethodPath("/api/v1/records", "search"),
    {
      params: { search: customMethodParameter("search") },
      payload: recordSearchInput,
      success: recordSearchResult,
      error: [
        toEffectErrorSchema(UnauthenticatedError).pipe(
          HttpApiSchema.status(401)
        ),
        toEffectErrorSchema(InternalError).pipe(HttpApiSchema.status(500)),
      ],
    }
  ).annotateMerge(
    OpenApi.annotations({
      identifier: "searchRecords",
      summary: "Search records across objects",
      description:
        "Searches explicitly indexed model fields using word prefixes, with all terms required. Returns ranked display summaries, filtered by current read permissions. Optional objectTypes narrows the search. hasMore means narrow the query or increase limit (maximum 50); use object list APIs for exhaustive traversal.",
    })
  )
)

/** The one HTTP contract used by handlers, clients, OpenAPI, and documentation. */
export const applicationHttpApi = documentIdentity(
  createModelHttpApi(Model, {
    id: appMetadata.id,
    version: appMetadata.version,
  })
    .add(capabilityGroup)
    .add(eventGroup)
    .add(recordGroup)
)
