import { Effect, Layer } from "effect"

import { Model } from "#/app.model.ts"
import { serverModules } from "#/app.server.ts"
import type { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { modelImplementation } from "#/runtime/server/model/implementation.ts"
import {
  runSeedScenario as runScenario,
  type SeedScenario,
} from "#/runtime/server/seed-scenario.ts"
import {
  makeServicesLayer,
  type ServicesInfrastructure,
} from "#/runtime/server/services.ts"
import { Database } from "#/runtime/server/storage/database.ts"

export type ApplicationServicesInfrastructure = ServicesInfrastructure

/**
 * Services, storage, cascades, and the event journal always see the complete
 * model. Exposure through HTTP, MCP, and the UI is decided by EnabledModel.
 */
export const ModelImplementation = modelImplementation(Model)

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
  infrastructure: Omit<ServicesInfrastructure, "database"> = {}
) {
  return Effect.gen(function* () {
    const database = yield* Database
    return yield* runScenario(scenario).pipe(
      Effect.provide(
        makeApplicationServicesLayer({
          ...infrastructure,
          database: Layer.succeed(Database, database),
        })
      )
    )
  })
}
