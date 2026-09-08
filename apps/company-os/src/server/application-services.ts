import {
  makeServicesLayer,
  type ServicesInfrastructure,
} from "@company/runtime/server/services"
import { Layer } from "effect"

import { Model } from "#/app.model.ts"
import { serverModules } from "#/app.server.ts"
import { verifyDatabaseModel } from "#/server/database/migrations.ts"

export type ApplicationServicesInfrastructure = ServicesInfrastructure

export function makeApplicationServicesLayer(
  infrastructure: ApplicationServicesInfrastructure
) {
  const services = makeServicesLayer(Model, serverModules, infrastructure)
  return Layer.merge(
    services,
    Layer.effectDiscard(verifyDatabaseModel()).pipe(Layer.provide(services))
  )
}
