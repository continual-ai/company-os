import { AccessServer } from "@company/runtime/server/access"
import { AssetsServer } from "@company/runtime/server/assets"
import { Database } from "@company/runtime/server/database/database"
import type { CurrentInvocation } from "@company/runtime/server/invocation"
import { modelImplementation } from "@company/runtime/server/model/implementation"
import {
  runSeedScenario as runScenario,
  type SeedScenario,
} from "@company/runtime/server/seed-scenario"
import {
  makeServicesLayer,
  type ServicesInfrastructure,
} from "@company/runtime/server/services"
import { SalesServer } from "@company/sales/server"
import { Effect, Layer } from "effect"

import { Model } from "#/examples/model.ts"
import { SupportEngineeringServer } from "#/modules/support-engineering/server/index.ts"

export const ModelImplementation = modelImplementation(Model)
const serverModules = [
  AccessServer,
  AssetsServer,
  SalesServer,
  SupportEngineeringServer,
] as const
export function makeApplicationServicesLayer(
  infrastructure: ServicesInfrastructure
) {
  return makeServicesLayer(Model, serverModules, infrastructure)
}

type ExampleEnvironment = Layer.Success<
  ReturnType<typeof makeApplicationServicesLayer>
>
export function runSeedScenario(
  scenario: SeedScenario<ExampleEnvironment | CurrentInvocation>,
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
