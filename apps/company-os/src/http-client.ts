import type { Model } from "@company/model"
import type { ModelHttpClient } from "@company/runtime/effect/http"
import { Effect } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { HttpApiClient } from "effect/unstable/httpapi"

import { applicationHttpApi } from "./http-api"
import type { capabilityGroup } from "./http-api"

export type ApplicationHttpClient = ModelHttpClient<typeof Model> &
  HttpApiClient.Client<typeof capabilityGroup>

/** Native Effect client derived from the same HTTP contract as the server. */
// SAFETY: Model generates the widened portion of applicationHttpApi at runtime;
// ModelHttpClient restores that same closed definition's static method shape.
// oxlint-disable-next-line anti-slop/require-safety-comment-for-type-assertion, typescript/no-unsafe-type-assertion
export const httpClient = Effect.runSync(
  HttpApiClient.make(applicationHttpApi).pipe(
    Effect.provide(FetchHttpClient.layer)
  )
) as ApplicationHttpClient
