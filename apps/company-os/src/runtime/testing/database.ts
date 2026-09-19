import { it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import type * as Scope from "effect/Scope"

import type { ModelCatalog } from "#/runtime/model/index.ts"
import { ApplicationKeys } from "#/runtime/server/application-keys.ts"
import { foundationLayer } from "#/runtime/server/foundation.ts"
import { systemInvocation } from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { PageTokens } from "#/runtime/server/page-tokens.ts"
import {
  makeSchemaStatements,
  initialJournalSql,
} from "#/runtime/server/schema.ts"
import { makePostgresSchema } from "#/runtime/server/storage/schema.ts"
import {
  TestDatabase,
  type DatabaseInitializer,
} from "#/runtime/server/storage/testing.ts"

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
 * opens a fresh pool, so each test starts from the initialized state without paying
 * for another CREATE DATABASE. Call at test-file top level; the global setup
 * removes every test database when the run ends.
 */
export function testDatabase<M extends ModelCatalog>(
  model: M,
  initialize: DatabaseInitializer = [
    ...makeSchemaStatements(model),
    initialJournalSql,
  ],
  /** Names the template for sharing when `initialize` is a function; statement arrays share by content. */
  key?: string
) {
  const template = Effect.runSync(
    Effect.cached(TestDatabase.createTemplate(initialize, key))
  )
  // Cache only identifiers; each test acquires and closes its own database connections.
  const clone = Effect.runSync(
    Effect.cached(template.pipe(Effect.flatMap(TestDatabase.clone)))
  )
  const client = Layer.unwrap(
    Effect.gen(function* () {
      const cloned = yield* clone
      yield* TestDatabase.reset(cloned)
      return TestDatabase.layer(cloned)
    })
  )
  const database = foundationLayer(model, {
    sql: client,
    pageTokens: PageTokens.layerTest,
    applicationKeys: ApplicationKeys.layerTest,
  })
  return {
    model,
    client,
    storage: makePostgresSchema(model),
    template,
    database,
    test: layerTest(database),
  }
}
