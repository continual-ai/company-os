import { it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import type * as Scope from "effect/Scope"
import { afterAll } from "vitest"

import type { ModelCatalog } from "#/runtime/model/index.ts"
import { systemInvocation } from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { makeSchemaSql } from "#/runtime/server/schema.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import { makePostgresSchema } from "#/runtime/server/storage/schema.ts"
import {
  TestDatabase,
  type TestDatabaseTemplate,
} from "#/runtime/server/storage/testing.ts"

/** SQL applied to an empty template, or a function that prepares it through a connection URL. */
export type DatabaseInitializer = string | ((url: string) => Promise<void>)

/** The projected schema plus the journal state row every runtime write expects. */
function schemaTemplateSql(model: ModelCatalog) {
  return (
    makeSchemaSql(model) +
    "\ninsert into event_journal_state (id, position) values (1, 0);"
  )
}

/**
 * Runs an Effect test under the system invocation with `layer` built once per
 * test, so every test that clones a database gets its own copy.
 */
export function layerTest<R, E>(layer: Layer.Layer<R, E>) {
  return <A, E2>(
    name: string,
    body: () => Effect.Effect<A, E2, R | CurrentInvocation | Scope.Scope>,
    timeout?: number
  ) =>
    it.effect(
      name,
      () =>
        body().pipe(
          Effect.provideService(CurrentInvocation, systemInvocation),
          Effect.provide(layer)
        ),
      timeout
    )
}

/**
 * One PostgreSQL template per test file, created on first use and dropped after
 * the file's tests. Call at test-file top level. Every build of `database`
 * clones the template into a fresh database and drops the clone with its scope.
 */
export function testDatabase<M extends ModelCatalog>(
  model: M,
  initialize: DatabaseInitializer = schemaTemplateSql(model)
) {
  let template: Promise<TestDatabaseTemplate> | undefined
  const acquire = () => (template ??= TestDatabase.createTemplate(initialize))
  afterAll(async () => {
    const created = await template?.catch(() => undefined)
    if (created !== undefined) await TestDatabase.drop(created)
  })
  const client = Layer.unwrap(
    Effect.promise(acquire).pipe(Effect.map(TestDatabase.layer))
  )
  const database = Database.layer.pipe(
    Layer.provideMerge(ModelContext.layer(model)),
    Layer.provide(client)
  )
  return {
    model,
    storage: makePostgresSchema(model),
    template: acquire,
    database,
    test: layerTest(database),
  }
}
