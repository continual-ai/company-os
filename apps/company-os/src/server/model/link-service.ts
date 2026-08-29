import { Model } from "@company/model"
import { makeLinkRepository } from "@company/postgres"
import { modelObjects, modelTypeAccepts } from "@company/runtime"
import {
  makeLinkService,
  makeLinkWriter as makeRuntimeLinkWriter,
} from "@company/runtime/effect/link-service"
import { ObjectNotFound } from "@company/runtime/effect/object-repository"
import { eq } from "drizzle-orm"
import { Context, Effect, Layer } from "effect"

import { Authorization } from "@/server/authorization/authorization-service"
import { Database } from "@/server/database/database"
import { Storage } from "@/server/database/schema"
import { PageTokens } from "@/server/page-tokens"

import { RecordIdentifierResolver } from "./record-identifier-resolver"

const make = Effect.gen(function* () {
  const authorization = yield* Authorization
  const database = yield* Database
  const identifiers = yield* RecordIdentifierResolver
  const pageTokens = yield* PageTokens
  const repository = makeLinkRepository(Storage, database, pageTokens)

  return makeLinkService(Model, repository, {
    resolve: identifiers.resolve,
    visibility: Effect.fn("@company/LinkService.visibility")(
      function* (traversal) {
        return yield* Effect.forEach(
          modelObjects(Model).filter((object) =>
            modelTypeAccepts(Model, object.id, traversal.target.from.typeId)
          ),
          (object) =>
            authorization
              .visibleWithin({ objectType: object.id, operation: "get" })
              .pipe(
                Effect.map((visibleWithin) => ({
                  objectType: object.id,
                  visibleWithin,
                }))
              )
        )
      }
    ),
    authorize: Effect.fn("@company/LinkService.authorize")(function* (request) {
      if (request.operation !== "initialize") {
        yield* authorization.requireAction({
          actionId: request.operation === "list" ? "get" : "update",
          objectType: request.source.id,
          recordIds: [request.sourceId],
        })
      }
      if (request.targetId === undefined) return undefined
      const [target] = yield* database
        .select({ objectType: Storage.core.objects.objectType })
        .from(Storage.core.objects)
        .where(eq(Storage.core.objects.id, request.targetId))
        .limit(1)
      if (target === undefined) {
        return yield* Effect.fail(
          new ObjectNotFound({
            objectType: request.traversal.target.from.typeId,
            recordId: request.targetId,
          })
        )
      }
      yield* authorization.requireAction({
        actionId: "get",
        objectType: target.objectType,
        recordIds: [request.targetId],
      })
      return undefined
    }),
  })
})

/** Validated Link writes for custom Actions that already established authority. */
export const makeLinkWriter = Effect.gen(function* () {
  const database = yield* Database
  const identifiers = yield* RecordIdentifierResolver
  const pageTokens = yield* PageTokens
  return makeRuntimeLinkWriter(
    Model,
    makeLinkRepository(Storage, database, pageTokens),
    { resolve: identifiers.resolve }
  )
})

/** Governed execution for every model-derived Link traversal. */
export class Links extends Context.Service<Links>()("@company/Links", {
  make,
}) {
  static readonly layer = Layer.effect(this, this.make)
}
