import { Effect, type Layer } from "effect"
import { expect } from "vitest"

import { defineModel, type ModuleDefinition } from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { ApplicationKeys } from "#/runtime/server/application-keys.ts"
import { Database } from "#/runtime/server/database.ts"
import { foundationLayer } from "#/runtime/server/foundation.ts"
import type { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { PageTokens } from "#/runtime/server/page-tokens.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"
import { testDatabase } from "#/runtime/testing/database.ts"
import { seededLayer } from "#/runtime/testing/foundation.ts"

/**
 * Declares one test proving `module` migrates and persists with the kernel plus
 * only `dependencies`: `create` writes through the model writers, the record
 * is journaled, and `absentTable` from an undeclared module does not exist.
 * Call at test-file top level.
 */
export function expectModuleStandsAlone(
  module: ModuleDefinition,
  dependencies: ReadonlyArray<ModuleDefinition>,
  options: {
    readonly create: (
      records: typeof Database.Service
    ) => Effect.Effect<
      { readonly id: string },
      unknown,
      Layer.Success<ReturnType<typeof foundationLayer>> | CurrentInvocation
    >
    readonly absentTable: string
  }
) {
  const fixture = testDatabase(
    defineModel({
      name: `${module.name} standalone`,
      modules: [PlatformModule, ...dependencies, module],
    })
  )
  const layer = seededLayer(
    foundationLayer(fixture.model, {
      sql: fixture.client,
      pageTokens: PageTokens.layerTest,
      applicationKeys: ApplicationKeys.layerTest,
    })
  )
  fixture.test("persists its own model with only declared dependencies", () =>
    Effect.gen(function* () {
      const { sql } = yield* SqlDatabase
      const record = yield* options.create(yield* Database)
      expect(
        yield* sql`select id from objects where id = ${record.id}`
      ).toEqual([{ id: record.id }])
      expect(
        yield* sql`select to_regclass(${options.absentTable}) as unrelated`
      ).toEqual([{ unrelated: null }])
      expect(
        (yield* sql`select count(*)::int as count from event_journal`)[0]?.count
      ).toBeGreaterThan(0)
    }).pipe(Effect.provide(layer))
  )
}
