import { AcmeModel } from "@acme/api"
import {
  makeObjectRepository as makePostgresObjectRepository,
  resolveRecordAliases as resolvePostgresRecordAliases,
} from "@continual/postgres"
import { modelTypeAccepts, type RecordAlias } from "@continual/runtime"
import { RecordAliasNotFound } from "@continual/runtime/effect/object-repository"
import { Effect } from "effect"

import { Database } from "./database.server"
import { AcmeStorage } from "./schema.server"

type AcmeObjectType = (typeof AcmeModel.objects)[keyof typeof AcmeModel.objects]

/** Resolves an alias across every object type; callers authorize the result. */
export const resolveRecordAlias = Effect.fn(
  "@acme/modelStorage.resolveRecordAlias"
)(function* (alias: RecordAlias) {
  const database = yield* Database
  const resolved = yield* resolvePostgresRecordAliases(AcmeStorage, database, [
    alias,
  ])
  const reference = resolved[0]
  return reference === undefined
    ? yield* Effect.die("Record alias resolver returned no result.")
    : reference
})

/** Captures Acme storage and resolves typed aliases in one ordered batch. */
export const makeRecordAliasResolver = Effect.gen(function* () {
  const database = yield* Database

  return Effect.fn("@acme/modelStorage.resolveTypedRecordAliases")(function* (
    expectedType: string,
    aliases: ReadonlyArray<RecordAlias>
  ) {
    const resolved = yield* resolvePostgresRecordAliases(
      AcmeStorage,
      database,
      aliases
    )
    const mismatch = resolved.findIndex(
      (reference) =>
        !modelTypeAccepts(AcmeModel, reference.objectType, expectedType)
    )
    if (mismatch !== -1) {
      return yield* Effect.fail(
        new RecordAliasNotFound({ alias: aliases[mismatch]! })
      )
    }
    return resolved.map(({ id }) => id)
  })
})

/** Builds a repository from Acme's model-derived private storage projection. */
export function makeObjectRepository<const TObject extends AcmeObjectType>(
  object: TObject
) {
  return Effect.gen(function* () {
    const database = yield* Database
    return yield* makePostgresObjectRepository(AcmeStorage, object, database)
  })
}
