import { Context, Effect, Layer } from "effect"

import type { ObjectType } from "#/model/index.ts"
import { ROOT_ID } from "#/model/system-records.ts"
import type { AssetPrecondition } from "#/server/assets/asset-error.ts"
import { makeObjectRepository } from "#/server/database/object-repository.ts"
import { ModelContext } from "#/server/model-context.ts"
import { RecordIdentifierResolver } from "#/server/model/record-identifier-resolver.ts"
import type { Repository } from "#/server/object-repository.ts"
import { makeWriter } from "#/server/object-service.ts"
import type { PostgresRepositoryError } from "#/server/postgres/object-repository.ts"

const make = Effect.gen(function* () {
  const { model } = yield* ModelContext
  const identifiers = yield* RecordIdentifierResolver
  const entries = yield* Effect.forEach(
    Object.values(model.objects),
    (object) =>
      makeObjectRepository(object).pipe(
        Effect.map((repository) => [object.id, repository] as const)
      )
  )
  const repositories = new Map(entries)
  const records = {
    get<O extends ObjectType>(
      object: O
    ): Repository<O, PostgresRepositoryError | AssetPrecondition> {
      const repository = repositories.get(object.id)
      if (
        (model.objects[object.id] !== object &&
          !Object.values(model.modules).some((module) =>
            module.objects.includes(object)
          )) ||
        repository === undefined
      )
        throw new Error(`Object '${object.id}' is not installed.`)
      // SAFETY: every repository was constructed from this exact definition.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return repository as unknown as Repository<
        O,
        PostgresRepositoryError | AssetPrecondition
      >
    },
  }
  return {
    ...records,
    writer: <O extends ObjectType>(object: O) =>
      makeWriter(object, records.get(object), {
        rootId: ROOT_ID,
        resolveRecordAliases: identifiers.resolveAliases,
      }),
  }
})
/** Typed persistence for an installed object; standard writes retain events and integrity checks. */
export class ObjectRepositories extends Context.Service<ObjectRepositories>()(
  "@company/runtime/ObjectRepositories",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
