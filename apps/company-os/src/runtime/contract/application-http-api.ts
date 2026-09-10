import { Schema } from "effect"
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  OpenApi,
} from "effect/unstable/httpapi"

import {
  eventPageSchema,
  InvalidEventCursor,
} from "#/runtime/contract/events.ts"
import {
  createModelHttpApi,
  type HttpApiOptions,
} from "#/runtime/contract/http-api.ts"
import {
  customMethodParameter,
  customMethodPath,
} from "#/runtime/contract/http-custom-method.ts"
import { createRecordSearchContract } from "#/runtime/contract/record-search.ts"
import { toEffectErrorSchema } from "#/runtime/contract/schema.ts"
import type { ModelCatalog } from "#/runtime/model/index.ts"
import { InternalError, UnauthenticatedError } from "#/runtime/model/index.ts"

const standardErrors = [
  toEffectErrorSchema(UnauthenticatedError).pipe(HttpApiSchema.status(401)),
  toEffectErrorSchema(InternalError).pipe(HttpApiSchema.status(500)),
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
  const { input: recordSearchInput, result: recordSearchResult } =
    createRecordSearchContract(model)
  const eventStreamSchema = HttpApiSchema.StreamSse({
    events: Schema.Struct({
      id: Schema.UndefinedOr(Schema.String),
      event: Schema.Literal("page"),
      data: Schema.fromJsonString(eventPageSchema),
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
      HttpApiEndpoint.get(
        "streamEvents",
        customMethodPath("/api/v1/events", "stream"),
        {
          params: { stream: customMethodParameter("stream") },
          query: Schema.Struct({ cursor: Schema.optionalKey(Schema.String) }),
          success: eventStreamSchema,
          error: standardErrors,
        }
      ).annotateMerge(
        OpenApi.annotations({
          summary: "Subscribe to committed events",
          description:
            "Authorized SSE pages. Resume using the last successfully applied nextCursor. Connections end after 60 seconds to renew authentication; access is checked on every page, including idle checkpoints.",
        })
      )
    )

  const recordGroup = HttpApiGroup.make("records").add(
    HttpApiEndpoint.post(
      "searchRecords",
      customMethodPath("/api/v1/records", "search"),
      {
        params: { search: customMethodParameter("search") },
        payload: recordSearchInput,
        success: recordSearchResult,
        error: standardErrors,
      }
    ).annotateMerge(
      OpenApi.annotations({
        identifier: "searchRecords",
        summary: "Search records across objects",
        description:
          "Searches explicitly indexed model fields using word prefixes, with all terms required. Returns ranked display summaries, limited to active object types. Optional objectTypes narrows the search. hasMore means narrow the query or increase limit (maximum 50); use object list APIs for exhaustive traversal.",
      })
    )
  )

  const api = createModelHttpApi(model, options)
    .add(eventGroup)
    .add(recordGroup)

  return { api, eventGroup, recordGroup }
}

export type ApplicationHttpApi = ReturnType<typeof createApplicationHttpApi>
