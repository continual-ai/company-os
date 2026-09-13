import { PgClient } from "@effect/sql-pg"
import { Effect, Layer } from "effect"

import { Model } from "#/app.model.ts"
import { serverModules } from "#/app.server.ts"
import type { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { operationsFor } from "#/runtime/server/operation-executor.ts"
import {
  runSeedScenario as runScenario,
  type SeedScenario,
} from "#/runtime/server/seed-scenario.ts"
import {
  makeServicesLayer,
  type ServicesInfrastructure,
} from "#/runtime/server/services.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"

export type ApplicationServicesInfrastructure = ServicesInfrastructure

/**
 * Services, storage, cascades, and the event journal always see the complete
 * model. SqlDatabase activation controls exposure through HTTP, MCP, and the UI.
 */
export const applicationOperations = operationsFor(Model)

export function makeApplicationServicesLayer(
  infrastructure: ApplicationServicesInfrastructure
) {
  return makeServicesLayer(Model, serverModules, infrastructure)
}

type ApplicationEnvironment = Layer.Success<
  ReturnType<typeof makeApplicationServicesLayer>
>

/** Runs a seed scenario with the application's services bound to the current database. */
export function runSeedScenario(
  scenario: SeedScenario<ApplicationEnvironment | CurrentInvocation>,
  infrastructure: Omit<ServicesInfrastructure, "sql"> = {}
) {
  return Effect.gen(function* () {
    const database = yield* SqlDatabase
    return yield* runScenario(scenario).pipe(
      Effect.provide(
        makeApplicationServicesLayer({
          ...infrastructure,
          sql: Layer.succeed(PgClient.PgClient, database.sql),
        })
      )
    )
  })
}
