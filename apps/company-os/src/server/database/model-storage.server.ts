import type { AcmeModel } from "@acme/api"
import {
  makeObjectRepository as makePostgresObjectRepository,
  resolveObjectAlias as resolvePostgresObjectAlias,
} from "@continual/postgres"
import type { ObjectAlias } from "@continual/runtime"
import { Effect } from "effect"

import { Database } from "./database.server"
import { AcmeStorage } from "./schema.server"

type AcmeObjectType = (typeof AcmeModel.objects)[keyof typeof AcmeModel.objects]

/** Resolves an alias across every object type; callers authorize the result. */
export const resolveObjectAlias = Effect.fn(
  "@acme/modelStorage.resolveObjectAlias"
)(function* (alias: ObjectAlias) {
  const database = yield* Database
  return yield* resolvePostgresObjectAlias(AcmeStorage, database, alias)
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
