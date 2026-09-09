import { it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import type * as Scope from "effect/Scope"

import type { ModelCatalog } from "#/runtime/model/index.ts"
import { systemInvocation } from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { makeSchemaSql } from "#/runtime/server/schema.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import { makePostgresSchema } from "#/runtime/server/storage/schema.ts"
import {
  TestDatabase,
  type TestDatabaseClone,
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
 * Cloning a template and running a scenario takes seconds when every test file
 * hits PostgreSQL at once. `it.effect` ignores the project's testTimeout, so the
 * default is set here.
 */
const DATABASE_TEST_TIMEOUT = 60_000

/**
 * Runs an Effect test under the system invocation with `layer` built once per
 * test, so every test that clones a database gets its own copy.
 */
export function layerTest<R, E>(layer: Layer.Layer<R, E>) {
  return <A, E2>(
    name: string,
    body: () => Effect.Effect<A, E2, R | CurrentInvocation | Scope.Scope>,
    timeout: number = DATABASE_TEST_TIMEOUT
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
 * One shared template per schema and one clone per test file. Every build of
 * `database` resets the clone (truncate and restore the journal position) and
 * opens a fresh pool, so each test starts from the migrated state without paying
 * for another CREATE DATABASE. Call at test-file top level; the global setup
 * removes every test database when the run ends.
 */
export function testDatabase<M extends ModelCatalog>(
  model: M,
  initialize: DatabaseInitializer = schemaTemplateSql(model),
  /** Names the template for sharing when `initialize` is a function; string initializers share by content. */
  key?: string
) {
  let template: Promise<TestDatabaseTemplate> | undefined
  let clone: Promise<TestDatabaseClone> | undefined
  const acquire = () =>
    (template ??= TestDatabase.createTemplate(initialize, key))
  // Clones and templates are dropped once by the global teardown; per-file drops
  // would race each other on DROP DATABASE and time out their hooks.
  const acquireClone = () => (clone ??= acquire().then(TestDatabase.clone))
  const client = Layer.unwrap(
    Effect.promise(async () => {
      const cloned = await acquireClone()
      await TestDatabase.reset(cloned)
      return TestDatabase.layer(cloned)
    })
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
