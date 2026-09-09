import { Context, Effect, Layer } from "effect"

import {
  isRecordAlias,
  modelTypeAccepts,
  type RecordAlias,
  type RecordId,
  type RecordIdentifier,
} from "#/runtime/model/index.ts"
import { Database } from "#/runtime/server/database/database.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { RecordAliasNotFound } from "#/runtime/server/object-repository.ts"
import { resolveRecordAliases as resolvePostgresRecordAliases } from "#/runtime/server/postgres/index.ts"

const make = Effect.gen(function* () {
  const context = yield* ModelContext
  const { model: Model, storage: Storage } = context
  const database = yield* Database

  const resolveAliases = Effect.fn(
    "@company/RecordIdentifierResolver.resolveAliases"
  )(function* <const TExpectedType extends string>(
    expectedType: TExpectedType,
    aliases: ReadonlyArray<RecordAlias>
  ) {
    const resolved = yield* resolvePostgresRecordAliases(
      Storage,
      database,
      aliases
    )
    const mismatch = resolved.findIndex(
      (reference) =>
        !modelTypeAccepts(Model, reference.objectType, expectedType)
    )
    if (mismatch !== -1) {
      return yield* Effect.fail(
        new RecordAliasNotFound({ alias: aliases[mismatch]! })
      )
    }
    return resolved.map(({ id }) => {
      // SAFETY: modelTypeAccepts above proves each concrete record is accepted
      // wherever the requested object or interface identifier is required.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return id as unknown as RecordId<TExpectedType>
    })
  })

  const resolve = Effect.fn("@company/RecordIdentifierResolver.resolve")(
    function* <const TExpectedType extends string>(
      expectedType: TExpectedType,
      identifier: RecordIdentifier<TExpectedType>
    ) {
      if (!isRecordAlias(identifier)) return identifier
      const resolved = yield* resolveAliases(expectedType, [identifier])
      const id = resolved[0]
      return id === undefined
        ? yield* Effect.die("Record alias resolver returned no result.")
        : id
    }
  )

  return { resolve, resolveAliases }
})

/** Canonicalizes record identifiers and rejects aliases with incompatible targets. */
export class RecordIdentifierResolver extends Context.Service<RecordIdentifierResolver>()(
  "@company/RecordIdentifierResolver",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
