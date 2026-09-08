import {
  createModelClient,
  type ModelHttpClient,
} from "@company/runtime/effect/http-client"
import { customMethodParams } from "@company/runtime/effect/http-custom-method"
import { Effect } from "effect"
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "effect/unstable/http"
import { HttpApiClient } from "effect/unstable/httpapi"

import { Model } from "#/app.model.ts"
import { applicationHttpApi } from "#/http-api.ts"
import type { capabilityGroup, eventGroup, recordGroup } from "#/http-api.ts"
import { modelFetch, modelOrigin } from "#/model-fetch.ts"
import {
  ClientChanges,
  createModelQueries,
  modelQuery,
  runClientEffect,
} from "#/model-query-client.ts"
import { searchableObjects, type RecordSearchInput } from "#/records.ts"

type ApplicationTransportClient = ModelHttpClient<typeof Model> &
  HttpApiClient.Client<typeof capabilityGroup> &
  HttpApiClient.Client<typeof eventGroup> &
  HttpApiClient.Client<typeof recordGroup>

/** Native Effect client derived from the same HTTP contract as the server. */
// SAFETY: Model generates the widened portion of applicationHttpApi at runtime;
// ModelHttpClient restores that same closed definition's static method shape.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const transportClient = Effect.runSync(
  HttpApiClient.make(applicationHttpApi, {
    transformClient: (http) =>
      http.pipe(
        HttpClient.mapRequestEffect((request) =>
          Effect.promise(modelOrigin).pipe(
            Effect.map((origin) =>
              HttpClientRequest.prependUrl(request, origin)
            )
          )
        ),
        HttpClient.tap((response) =>
          Effect.gen(function* () {
            const changes = yield* ClientChanges
            if (response.status < 400)
              for (const type of response.headers["x-model-changes"]?.split(
                ","
              ) ?? [])
                changes?.add(type)
          })
        )
      ),
  }).pipe(
    Effect.provide(FetchHttpClient.layer),
    Effect.provideService(FetchHttpClient.Fetch, modelFetch)
  )
) as unknown as ApplicationTransportClient

/** Semantic object, Action, and Link client derived from the application contract. */
const client = createModelClient(Model, transportClient)
export const data = {
  ...createModelQueries(Model, client),
  records: {
    search: (input: RecordSearchInput) =>
      modelQuery(
        input.objectTypes ?? searchableObjects.map((object) => object.id),
        "records.search",
        input,
        (signal) =>
          runClientEffect(
            transportClient.records.searchRecords({
              params: customMethodParams("search"),
              payload: input,
            }),
            signal
          )
      ),
  },
}

/** Checks advisory UI capabilities through the generated application contract. */
export const checkCapabilities = (
  input: Omit<
    Parameters<typeof transportClient.capabilities.checkCapabilities>[0],
    "params"
  >
) => {
  const request = { ...input, params: customMethodParams("check") }
  return transportClient.capabilities.checkCapabilities(request)
}

/** Reads the durable, authorized feed without caching a cursor response. */
export const listEvents = (
  query: {
    readonly cursor?: string
    readonly type?: string
    readonly pageSize?: number
  } = {}
) => transportClient.events.listEvents({ query })

/** Typed streaming transport; checkpoints advance only after the cache applies each page. */
export const subscribeEvents = (cursor: string) =>
  transportClient.events.streamEvents({
    params: customMethodParams("stream"),
    query: { cursor },
  })
