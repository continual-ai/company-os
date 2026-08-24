import { Model } from "@company/model"
import {
  makeObjectRepository as makePostgresObjectRepository,
  resolveRecordAliases as resolvePostgresRecordAliases,
} from "@company/postgres"
import { modelTypeAccepts, type RecordAlias } from "@company/runtime"
import { RecordAliasNotFound } from "@company/runtime/effect/object-repository"
import { Effect } from "effect"

import { Database } from "./database.server"
import { Storage } from "./schema.server"

type ModelObjectType = (typeof Model.objects)[keyof typeof Model.objects]

/** Resolves an alias across every object type; callers authorize the result. */
export const resolveRecordAlias = Effect.fn(
  "@company/modelStorage.resolveRecordAlias"
)(function* (alias: RecordAlias) {
  const database = yield* Database
  const resolved = yield* resolvePostgresRecordAliases(Storage, database, [
    alias,
  ])
  const reference = resolved[0]
  return reference === undefined
    ? yield* Effect.die("Record alias resolver returned no result.")
    : reference
})

/** Captures model storage and resolves typed aliases in one ordered batch. */
export const makeRecordAliasResolver = Effect.gen(function* () {
  const database = yield* Database

  return Effect.fn("@company/modelStorage.resolveTypedRecordAliases")(
    function* (expectedType: string, aliases: ReadonlyArray<RecordAlias>) {
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
      return resolved.map(({ id }) => id)
    }
  )
})

/** Builds a repository from the model-derived private storage projection. */
export function makeObjectRepository<const TObject extends ModelObjectType>(
  object: TObject
) {
  return Effect.gen(function* () {
    const database = yield* Database
    return yield* makePostgresObjectRepository(Storage, object, database)
  })
}
