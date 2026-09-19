import { Schema } from "effect"
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  OpenApi,
} from "effect/unstable/httpapi"

import {
  eventPageSchema,
  changePageSchema,
  InvalidEventCursor,
} from "#/runtime/contract/events.ts"
import {
  createModelHttpApi,
  type HttpApiOptions,
} from "#/runtime/contract/http-api.ts"
import { toEffectErrorSchema } from "#/runtime/contract/schema.ts"
import {
  type ModelCatalog,
  InternalError,
  UnauthenticatedError,
  PermissionDeniedError,
  ValidationError,
} from "#/runtime/model/index.ts"

const standardErrors = [
  toEffectErrorSchema(UnauthenticatedError).pipe(HttpApiSchema.status(401)),
  toEffectErrorSchema(InternalError).pipe(HttpApiSchema.status(500)),
  toEffectErrorSchema(PermissionDeniedError).pipe(HttpApiSchema.status(403)),
  toEffectErrorSchema(ValidationError).pipe(HttpApiSchema.status(400)),
]

/**
 * The complete HTTP contract of an application: every exposed object's
 * operations plus the event and record-search groups that
 * exist outside the model. Handlers, clients, OpenAPI, and tests derive
 * from this one value.
 */
export function createApplicationHttpApi(
  model: ModelCatalog,
  options: HttpApiOptions = {}
) {
  const changeStreamSchema = HttpApiSchema.StreamSse({
    events: Schema.Struct({
      id: Schema.UndefinedOr(Schema.String),
      event: Schema.Literal("page"),
      data: Schema.fromJsonString(changePageSchema),
    }),
    error: InvalidEventCursor,
  })

  const eventGroup = HttpApiGroup.make("events")
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
          ...standardErrors,
        ],
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "listEvents",
          summary: "Read committed events",
          description:
            "Returns project facts in commit order. Continue with nextCursor even after an empty page. cursor=now starts at the current head; reset requires reloading cached data. Events are retained indefinitely in this release.",
        })
      )
    )
    .add(
      HttpApiEndpoint.get("listChanges", "/api/v1/changes", {
        query: Schema.Struct({ cursor: Schema.optionalKey(Schema.String) }),
        success: changePageSchema,
        error: [
          InvalidEventCursor.pipe(HttpApiSchema.status(400)),
          ...standardErrors,
        ],
      }).annotateMerge(
        OpenApi.annotations({
          summary: "Read committed changes",
          description:
            "Compact cache invalidations from the event journal. Resume with nextCursor; reset requires reloading cached data.",
        })
      )
    )
    .add(
      HttpApiEndpoint.get("streamChanges", "/api/v1/changes:stream", {
        params: {},
        query: Schema.Struct({ cursor: Schema.optionalKey(Schema.String) }),
        success: changeStreamSchema,
        error: standardErrors,
      }).annotateMerge(
        OpenApi.annotations({
          summary: "Subscribe to committed changes",
          description:
            "Authorized SSE pages. Resume using the last successfully applied nextCursor. Connections end after 60 seconds to renew authentication; access is checked on every page, including idle checkpoints.",
        })
      )
    )

  const api = createModelHttpApi(model, options).add(eventGroup)

  return { api, eventGroup }
}

export type ApplicationHttpApi = ReturnType<typeof createApplicationHttpApi>
