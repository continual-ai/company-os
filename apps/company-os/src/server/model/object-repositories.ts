import type { PostgresRepositoryError } from "@company/postgres"
import type { Repository } from "@company/runtime/effect/object-repository"
import { Model } from "company-os/model"
import { Context, Effect, Layer } from "effect"

import type { AssetPrecondition } from "@/modules/assets/asset/server/asset-error"
import { makeObjectRepository } from "@/server/database/object-repository"

type ObjectRepositoryMap = {
  readonly [TObjectId in keyof typeof Model.objects]: Repository<
    (typeof Model.objects)[TObjectId],
    PostgresRepositoryError | AssetPrecondition
  >
}

const make = Effect.gen(function* () {
  const entries = yield* Effect.forEach(
    Object.values(Model.objects),
    (object) => {
      return makeObjectRepository(object).pipe(
        Effect.map((repository) => [object.id, repository] as const)
      )
    }
  )

  // SAFETY: modelObjects returns every object in Model exactly once and each
  // repository is constructed from that same object definition.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return Object.fromEntries(entries) as unknown as ObjectRepositoryMap
})

/** Model-derived persistence capabilities for standard object behavior. */
export class ObjectRepositories extends Context.Service<ObjectRepositories>()(
  "@company/ObjectRepositories",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
