import { Effect, Layer } from "effect"

import { bootstrapSystemActor } from "#/runtime/access/server/bootstrap.ts"
import { seedAuthorization } from "#/runtime/access/server/seed.ts"
import type { ModelCatalog } from "#/runtime/model/index.ts"
import { Database } from "#/runtime/server/database/database.ts"
import { foundationLayer } from "#/runtime/server/foundation.ts"
import { systemInvocation } from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { PageTokens } from "#/runtime/server/page-tokens.ts"
import { TestDatabase } from "#/runtime/server/postgres/testing.ts"
import { makeSchemaSql } from "#/runtime/server/schema.ts"

/** Creates an isolated template; each layer scope gets a fresh database with real authorization and event services. */
export async function testFoundation(model: ModelCatalog) {
  const template = await TestDatabase.createTemplate(
    makeSchemaSql(model) +
      "\ninsert into event_journal_state (id, position) values (1, 0);"
  )
  const database = Database.layer.pipe(
    Layer.provideMerge(ModelContext.layer(model)),
    Layer.provide(TestDatabase.layer(template))
  )
  const services = foundationLayer(model, {
    database,
    pageTokens: PageTokens.layerTest,
  })
  const initialize = Layer.effectDiscard(
    bootstrapSystemActor().pipe(
      Effect.andThen(seedAuthorization()),
      Effect.provideService(CurrentInvocation, systemInvocation)
    )
  ).pipe(Layer.provide(services))
  return {
    database,
    layer: Layer.merge(services, initialize),
    dispose: () => TestDatabase.drop(template),
  }
}
