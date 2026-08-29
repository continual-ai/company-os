import type { Model } from "@company/model"
import { makeObjectRepository as makePostgresObjectRepository } from "@company/postgres"
import { Effect } from "effect"

import { PageTokens } from "@/server/page-tokens"

import { Database } from "./database"
import { Storage } from "./schema"

type ModelObjectType = (typeof Model.objects)[keyof typeof Model.objects]

/** Builds a repository from the model-derived private storage projection. */
export function makeObjectRepository<const TObject extends ModelObjectType>(
  object: TObject
) {
  return Effect.gen(function* () {
    const database = yield* Database
    const pageTokens = yield* PageTokens
    return yield* makePostgresObjectRepository(
      Storage,
      object,
      database,
      pageTokens
    )
  })
}
