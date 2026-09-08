import { Effect, Layer } from "effect"

import type { ModelCatalog } from "#/model/index.ts"
import { bootstrapSystemActor } from "#/server/access/bootstrap.ts"
import { seedAuthorization } from "#/server/access/seed.ts"
import { Database } from "#/server/database/database.ts"
import { foundationLayer } from "#/server/foundation.ts"
import { systemInvocation } from "#/server/invocation-context.ts"
import { CurrentInvocation } from "#/server/invocation.ts"
import { ModelContext } from "#/server/model-context.ts"
import { PageTokens } from "#/server/page-tokens.ts"
import { TestDatabase } from "#/server/postgres/testing.ts"
import { makeSchemaSql } from "#/server/schema.ts"

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
