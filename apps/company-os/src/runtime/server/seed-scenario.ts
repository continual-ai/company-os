import { Effect } from "effect"

import { systemInvocation } from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import { insertValues } from "#/runtime/server/storage/index.ts"
import {
  tableProjection,
  type TableRow,
} from "#/runtime/server/storage/index.ts"
import { seedRuns } from "#/runtime/server/storage/infrastructure.ts"

export interface SeedScenario<R = never> {
  readonly name: string
  readonly parameters: Readonly<Record<string, string | number>>
  readonly run: Effect.Effect<void, unknown, R>
}

/** Runs once per database. Receipts and governed writes commit together; reruns preserve edits and deletions. */
export const runSeedScenario = Effect.fn("@company/runSeedScenario")(function* <
  R,
>(scenario: SeedScenario<R>) {
  const database = yield* Database
  const sql = database.sql
  const parameters = JSON.stringify(
    Object.entries(scenario.parameters).sort(([a], [b]) => a.localeCompare(b))
  )
  return yield* database.transaction(() =>
    Effect.gen(function* () {
      yield* sql`select pg_advisory_xact_lock(hashtext('company-os:seed'))`
      const [existing] = yield* sql<
        TableRow<typeof seedRuns>
      >`select ${tableProjection(seedRuns)}
          from ${seedRuns}
          where ${seedRuns.columns.name} = ${scenario.name}`
      if (existing !== undefined) {
        if (existing.parameters !== parameters)
          return yield* Effect.fail(
            new Error(
              `Scenario '${scenario.name}' already ran with different parameters. Use a fresh development database to change its size.`
            )
          )
        return "skipped" as const
      }
      yield* scenario.run.pipe(
        Effect.provideService(CurrentInvocation, systemInvocation)
      )
      yield* sql`insert into ${seedRuns} ${insertValues(sql, seedRuns, { name: scenario.name, parameters })}`
      return "seeded" as const
    })
  )
})
