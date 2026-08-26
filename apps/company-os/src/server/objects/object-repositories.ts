/* oxlint-disable anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion -- Object.fromEntries cannot preserve a model-derived mapped type. */
import { Model } from "@company/model"
import type { PostgresRepositoryError } from "@company/postgres"
import { modelObjects } from "@company/runtime"
import type { Repository } from "@company/runtime/effect/object-repository"
import { Context, Effect, Layer } from "effect"

import { makeObjectRepository } from "@/server/database/object-repository"

type ObjectRepositoryMap = {
  readonly [TObjectId in keyof typeof Model.objects]: Repository<
    (typeof Model.objects)[TObjectId],
    PostgresRepositoryError
  >
}

const make = Effect.gen(function* () {
  const entries = yield* Effect.forEach(modelObjects(Model), (object) => {
    // SAFETY: modelObjects returns values from this exact closed Model.
    const definition =
      object as (typeof Model.objects)[keyof typeof Model.objects]
    return makeObjectRepository(definition).pipe(
      Effect.map((repository) => [object.id, repository] as const)
    )
  })

  // SAFETY: modelObjects returns every object in Model exactly once and each
  // repository is constructed from that same object definition.
  return Object.fromEntries(entries) as ObjectRepositoryMap
})

/** Model-derived persistence capabilities for standard object behavior. */
export class ObjectRepositories extends Context.Service<ObjectRepositories>()(
  "@company/ObjectRepositories",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
