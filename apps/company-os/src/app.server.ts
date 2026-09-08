import { Context, Effect, Layer } from "effect"

import { AccessServer } from "#/modules/access/server.ts"
import { AssetsServer } from "#/modules/assets/server.ts"
import { SalesServer } from "#/modules/sales/server.ts"

const modules = [AccessServer, AssetsServer, SalesServer] as const

/** One explicit installation list; service construction stays inside each module. */
export const moduleServiceLayer = Layer.mergeAll(
  modules[0].layer,
  ...modules.slice(1).map((module) => module.layer)
)

export class ModuleServices extends Context.Service<ModuleServices>()(
  "@model/ModuleServices",
  {
    make: Effect.all(modules.map((module) => module.services)).pipe(
      Effect.map((implementations) => {
        const services: Record<string, object> = {}
        for (const implementation of implementations) {
          for (const [id, service] of Object.entries(implementation)) {
            if (Object.hasOwn(services, id))
              throw new Error(`Duplicate implementation for '${id}'.`)
            services[id] = service
          }
        }
        return services
      })
    ),
  }
) {
  static readonly layer = Layer.effect(this, this.make)
}
