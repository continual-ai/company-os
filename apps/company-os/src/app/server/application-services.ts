import { Effect, Layer } from "effect"

import { EnabledModel } from "#/app.model.ts"
import { serverModules } from "#/app.server.ts"
import { verifyDatabaseModel } from "#/app/server/database/migrations.ts"
import { Database } from "#/runtime/server/database/database.ts"
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

export type ApplicationServicesInfrastructure = ServicesInfrastructure

export const ModelImplementation = modelImplementation(EnabledModel)

export function makeApplicationServicesLayer(
  infrastructure: ApplicationServicesInfrastructure
) {
  const services = makeServicesLayer(
    EnabledModel,
    serverModules,
    infrastructure
  )
  return Layer.merge(
    services,
    Layer.effectDiscard(verifyDatabaseModel()).pipe(Layer.provide(services))
  )
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
