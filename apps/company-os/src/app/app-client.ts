import { Model } from "#/app.model.ts"
import { modelFetch, modelOrigin } from "#/app/client/model-fetch.ts"
import { createEffectClient } from "#/runtime/client/create-client.ts"
import { createModelQueries } from "#/runtime/client/model-query-client.ts"

/**
 * The application's own typed client. In the browser it calls the HTTP API at the
 * page origin; during SSR the same requests run through the transport in-process
 * with the current request's credentials.
 */
export const client = createEffectClient(Model, {
  baseUrl: modelOrigin,
  fetch: modelFetch,
})

/** Query and mutation options for every exposed object, Action, Link, and record search. */
export const data = createModelQueries(Model, client)
