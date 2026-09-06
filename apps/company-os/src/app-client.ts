import {
  createModelClient,
  type ModelHttpClient,
} from "@company/runtime/effect/http-client"
import { customMethodParams } from "@company/runtime/effect/http-custom-method"
import { Model } from "company-os/model"
import { Effect } from "effect"
import { FetchHttpClient, HttpClient } from "effect/unstable/http"
import { HttpApiClient } from "effect/unstable/httpapi"

import { modelData } from "./data-client"
import { applicationHttpApi } from "./http-api"
import type { capabilityGroup, eventGroup } from "./http-api"

type ApplicationTransportClient = ModelHttpClient<typeof Model> &
  HttpApiClient.Client<typeof capabilityGroup> &
  HttpApiClient.Client<typeof eventGroup>

/** Native Effect client derived from the same HTTP contract as the server. */
// SAFETY: Model generates the widened portion of applicationHttpApi at runtime;
// ModelHttpClient restores that same closed definition's static method shape.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const transportClient = Effect.runSync(
  HttpApiClient.make(applicationHttpApi, {
    transformClient: (http) =>
      http.pipe(
        HttpClient.tap((response) =>
          Effect.sync(() => {
            const changes = response.headers["x-model-changes"]
            if (
              response.status < 400 &&
              changes &&
              typeof window !== "undefined"
            )
              modelData().invalidate(changes.split(","))
          })
        )
      ),
  }).pipe(Effect.provide(FetchHttpClient.layer))
) as unknown as ApplicationTransportClient

/** Semantic object, Action, and Link client derived from the application contract. */
export const client = createModelClient(Model, transportClient, {
  transformQuery: (objectType, operation, input, effect) =>
    Effect.suspend(() =>
      typeof window === "undefined"
        ? effect
        : modelData().query(objectType, operation, input, effect)
    ),
})

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
