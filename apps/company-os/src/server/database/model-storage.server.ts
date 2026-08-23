import { AcmeModel } from "@acme/api"
import {
  makeObjectRepository as makePostgresObjectRepository,
  resolveRecordAlias as resolvePostgresRecordAlias,
} from "@continual/postgres"
import type { RecordAlias } from "@continual/runtime"
import { Data, Effect } from "effect"

import { Database } from "./database.server"
import { AcmeStorage } from "./schema.server"

type AcmeObjectType = (typeof AcmeModel.objects)[keyof typeof AcmeModel.objects]

export class RecordAliasTypeMismatch extends Data.TaggedError(
  "RecordAliasTypeMismatch"
)<{
  readonly actualObjectType: string
  readonly alias: string
  readonly expectedType: string
}> {}

/** Resolves an alias across every object type; callers authorize the result. */
export const resolveRecordAlias = Effect.fn(
  "@acme/modelStorage.resolveRecordAlias"
)(function* (alias: RecordAlias) {
  const database = yield* Database
  return yield* resolvePostgresRecordAlias(AcmeStorage, database, alias)
})

function acceptsType(actualObjectType: string, expectedType: string): boolean {
  if (actualObjectType === expectedType) return true
  const object = Object.values(AcmeModel.objects).find(
    ({ id }) => id === actualObjectType
  )
  return object !== undefined && Object.hasOwn(object.interfaces, expectedType)
}

/** Captures Acme storage and resolves aliases to validated canonical IDs. */
export const makeRecordAliasResolver = Effect.gen(function* () {
  const database = yield* Database

  return Effect.fn("@acme/modelStorage.resolveTypedRecordAlias")(function* (
    expectedType: string,
    alias: RecordAlias
  ) {
    const resolved = yield* resolvePostgresRecordAlias(
      AcmeStorage,
      database,
      alias
    )
    if (!acceptsType(resolved.objectType, expectedType)) {
      return yield* Effect.fail(
        new RecordAliasTypeMismatch({
          actualObjectType: resolved.objectType,
          alias,
          expectedType,
        })
      )
    }
    return resolved.id
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
