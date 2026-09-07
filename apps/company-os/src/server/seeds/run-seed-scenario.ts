import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { eq, sql } from "drizzle-orm"
import { Effect, Layer } from "effect"

import {
  makeApplicationServicesLayer,
  type ApplicationServicesInfrastructure,
} from "@/server/application-services"
import { Database } from "@/server/database/database"
import { seedRuns } from "@/server/database/schema"
import { systemInvocation } from "@/server/invocation-context"

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
  const parameters = JSON.stringify(
    Object.entries(scenario.parameters).sort(([a], [b]) => a.localeCompare(b))
  )
  return yield* database.transaction((tx) =>
    Effect.gen(function* () {
      yield* tx.execute(
        sql`select pg_advisory_xact_lock(hashtext('company-os:seed'))`
      )
      const [existing] = yield* tx
        .select()
        .from(seedRuns)
        .where(eq(seedRuns.name, scenario.name))
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
              Object.assign(tx, { $client: database.$client })
            ),
          })
        ),
        Effect.provideService(CurrentInvocation, systemInvocation)
      )
      yield* tx.insert(seedRuns).values({ name: scenario.name, parameters })
      return "seeded" as const
    })
  )
})
