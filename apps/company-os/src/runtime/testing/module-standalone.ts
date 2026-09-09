import { Effect, type Layer } from "effect"
import { expect } from "vitest"

import { AccessModule } from "#/runtime/access/model/index.ts"
import { AssetsModule } from "#/runtime/assets/model/index.ts"
import { defineModel, type ModuleDefinition } from "#/runtime/model/index.ts"
import { foundationLayer } from "#/runtime/server/foundation.ts"
import type { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { ObjectRepositories } from "#/runtime/server/model/object-repositories.ts"
import { PageTokens } from "#/runtime/server/page-tokens.ts"
import { Database } from "#/runtime/server/storage/database.ts"
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
      records: typeof ObjectRepositories.Service
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
      modules: [AccessModule, AssetsModule, ...dependencies, module],
    })
  )
  const layer = seededLayer(
    foundationLayer(fixture.model, {
      database: fixture.database,
      pageTokens: PageTokens.layerTest,
    })
  )
  fixture.test("persists its own model with only declared dependencies", () =>
    Effect.gen(function* () {
      const { sql } = yield* Database
      const record = yield* options.create(yield* ObjectRepositories)
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
