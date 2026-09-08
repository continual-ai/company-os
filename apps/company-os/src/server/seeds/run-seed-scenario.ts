import { insertValues } from "@company/postgres"
import { tableProjection, type TableRow } from "@company/postgres"
import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { Effect, Layer } from "effect"

import {
  makeApplicationServicesLayer,
  type ApplicationServicesInfrastructure,
} from "#/server/application-services.ts"
import { Database } from "#/server/database/database.ts"
import { seedRuns } from "#/server/database/schema.ts"
import { systemInvocation } from "#/server/invocation-context.ts"

type SeedEnvironment =
  | Layer.Success<ReturnType<typeof makeApplicationServicesLayer>>
  | CurrentInvocation

export interface SeedScenario {
  readonly name: string
  readonly parameters: Readonly<Record<string, string | number>>
  readonly run: Effect.Effect<void, unknown, SeedEnvironment>
}

/** Runs once per database. Receipts and governed writes commit together; reruns preserve edits and deletions. */
export const runSeedScenario = Effect.fn("@company/runSeedScenario")(function* (
  scenario: SeedScenario,
  infrastructure: Omit<ApplicationServicesInfrastructure, "database"> = {}
) {
  const database = yield* Database
  const sql = database.sql
  const parameters = JSON.stringify(
    Object.entries(scenario.parameters).sort(([a], [b]) => a.localeCompare(b))
  )
  return yield* database.transaction((tx) =>
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
        Effect.provide(
          makeApplicationServicesLayer({
            ...infrastructure,
            database: Layer.succeed(
              Database,
              Object.assign(tx, { $client: database.sql })
            ),
          })
        ),
        Effect.provideService(CurrentInvocation, systemInvocation)
      )
      yield* sql`insert into ${seedRuns} ${insertValues(sql, seedRuns, { name: scenario.name, parameters })}`
      return "seeded" as const
    })
  )
})
