import type { Model } from "@company/model"
import type { ModelHttpClient } from "@company/runtime/effect/http"
import { Effect } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { HttpApiClient } from "effect/unstable/httpapi"

import { applicationHttpApi } from "./http-api"
import type { capabilityGroup } from "./http-api"

export type CompanyApiClient = ModelHttpClient<typeof Model> &
  HttpApiClient.Client<typeof capabilityGroup>

/** Native Effect client derived from the same contract served by the backend. */
// SAFETY: Model generates the widened portion of applicationHttpApi at runtime;
// ModelHttpClient restores that same closed definition's static method shape.
// oxlint-disable-next-line anti-slop/require-safety-comment-for-type-assertion, typescript/no-unsafe-type-assertion
export const companyApi = Effect.runSync(
  HttpApiClient.make(applicationHttpApi).pipe(
    Effect.provide(FetchHttpClient.layer)
  )
) as CompanyApiClient
