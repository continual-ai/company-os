import type { PostgresRepositoryError } from "@company/postgres"
import {
  implementModel,
  type ModelServiceMap,
} from "@company/runtime/effect/model-implementation"
import type { Repository } from "@company/runtime/effect/object-repository"
import { Context, Effect, Layer } from "effect"

import { Model } from "#/app.model.ts"
import { ModuleServices } from "#/app.server.ts"
import type { AssetPrecondition } from "#/modules/assets/asset/server/asset-error.ts"
import { Links } from "#/server/model/link-service.ts"
import { ObjectRepositories } from "#/server/model/object-repositories.ts"
import { makeObjectService } from "#/server/model/object-service.ts"

const make = Effect.gen(function* () {
  const repositories = yield* ObjectRepositories
  const links = yield* Links
  function repositoryFor<
    TObject extends (typeof Model.objects)[keyof typeof Model.objects],
  >(
    object: TObject
  ): Repository<TObject, PostgresRepositoryError | AssetPrecondition> {
    // SAFETY: the repository registry was derived from the same object keys.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return repositories[object.id] as unknown as Repository<
      TObject,
      PostgresRepositoryError | AssetPrecondition
    >
  }
  const overrides = yield* ModuleServices
  const entries = yield* Effect.forEach(
    Object.values(Model.objects),
    (object) =>
      Effect.gen(function* () {
        const override = Reflect.get(overrides, object.id)
        return [
          object.id,
          {
            ...(yield* makeObjectService(object, repositoryFor(object))),
            ...override,
          },
        ] as const
      })
  )
  // SAFETY: every model object is bound once; implementModel verifies that all
  // declared custom actions are actually implemented before the app can start.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const services = Object.fromEntries(entries) as unknown as ModelServiceMap<
    typeof Model
  >
  return implementModel<typeof Model>(Model, services, links)
})

/** The application model exhaustively bound to its governed services. */
export class ModelImplementation extends Context.Service<ModelImplementation>()(
  "@company/ModelImplementation",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
