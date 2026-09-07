import {
  projection,
  type SelectionRow,
  inValues,
  sqlValue,
} from "@company/postgres"
import type { PostgresRepositoryError } from "@company/postgres"
import { makeLinkRepository } from "@company/postgres"
import type { ObjectType } from "@company/runtime"
import { modelTypeAccepts } from "@company/runtime"
import {
  makeLinkService,
  makeLinkWriter as makeRuntimeLinkWriter,
} from "@company/runtime/effect/link-service"
import type { Repository } from "@company/runtime/effect/object-repository"
import { ObjectNotFound } from "@company/runtime/effect/object-repository"
import { Model } from "company-os/model"
import { Context, Effect, Layer } from "effect"

import type { AssetPrecondition } from "@/modules/assets/asset/server/asset-error"
import { Authorization } from "@/server/authorization/authorization-service"
import { Database } from "@/server/database/database"
import { Storage } from "@/server/database/schema"
import { makeEventWriter } from "@/server/events/event-writer"
import { PageTokens } from "@/server/page-tokens"

import { ObjectRepositories } from "./object-repositories"
import { RecordIdentifierResolver } from "./record-identifier-resolver"

function trackedLinkRepository(
  database: typeof Database.Service,
  pageTokens: typeof PageTokens.Service
) {
  const sql = database.sql

  const repository = makeLinkRepository(Storage, database, pageTokens)
  const events = makeEventWriter(database)
  type Pair = Parameters<typeof repository.link>[0]
  const mutate = (input: Pair, operation: "link" | "unlink") =>
    database.transaction(() =>
      Effect.gen(function* () {
        const ids = [input.sourceId, input.targetId].sort()
        const selection = { id: Storage.core.objects.columns.id }
        yield* sql<
          SelectionRow<typeof selection>
        >`select ${projection(selection)}
          from ${Storage.core.objects}
          where ${inValues(sql, Storage.core.objects.columns.id, ids)}
          order by ${sql.csv([Storage.core.objects.columns.id])} for update`
        // Include subset edges: replacing a primary or removing its superset can delete another edge.
        const family = new Set([input.linkId])
        for (let size = 0; size !== family.size;) {
          size = family.size
          for (const link of Object.values(Model.links)) {
            if (
              link.subsetOf !== undefined &&
              (family.has(link.id) || family.has(link.subsetOf))
            ) {
              family.add(link.id)
              family.add(link.subsetOf)
            }
          }
        }
        const snapshot = () =>
          Effect.gen(function* () {
            const pairs = new Map<
              string,
              { linkId: string; forwardId: string; reverseId: string }
            >()
            for (const linkId of family) {
              const table = Object.entries(Storage.linkTables).find(
                ([id]) => id === linkId
              )?.[1]
              if (table === undefined)
                return yield* Effect.die(`Unknown Link '${linkId}'.`)
              const rowsFields = {
                forwardId: sqlValue<string>(sql`${table.columns.forwardId}`),
                reverseId: sqlValue<string>(sql`${table.columns.reverseId}`),
              }
              const rows = yield* sql<
                SelectionRow<typeof rowsFields>
              >`select ${projection(rowsFields)}
          from ${table}
          where (${inValues(sql, table.columns.forwardId, ids)} or ${inValues(sql, table.columns.reverseId, ids)})`
              for (const row of rows)
                pairs.set(
                  JSON.stringify([linkId, row.forwardId, row.reverseId]),
                  { linkId, ...row }
                )
            }
            return pairs
          })
        const before = yield* snapshot()
        const link = Object.values(Model.links).find(
          (candidate) => candidate.id === input.linkId
        )
        if (operation === "link" && link?.subsetOf !== undefined)
          yield* repository.link({ ...input, linkId: link.subsetOf })
        yield* repository[operation](input)
        const after = yield* snapshot()
        for (const [from, to, kind] of [
          [before, after, "unlinked"],
          [after, before, "linked"],
        ] as const) {
          for (const [key, pair] of from) {
            if (to.has(key)) continue
            yield* events.record({
              type: `${pair.linkId}.${kind}`,
              subjects: yield* events.subjects([
                pair.forwardId,
                pair.reverseId,
              ]),
              data: { link: pair.linkId },
            })
          }
        }
      })
    )
  return {
    ...repository,
    link: (input: Pair) => mutate(input, "link"),
    unlink: (input: Pair) => mutate(input, "unlink"),
  }
}

const make = Effect.gen(function* () {
  const authorization = yield* Authorization
  const database = yield* Database
  const sql = database.sql
  const identifiers = yield* RecordIdentifierResolver
  const pageTokens = yield* PageTokens
  const repository = trackedLinkRepository(database, pageTokens)
  const records = yield* ObjectRepositories

  return makeLinkService(
    Model,
    repository,
    {
      resolve: identifiers.resolve,
      visibility: Effect.fn("@company/LinkService.visibility")(
        function* (traversal) {
          const scopes = yield* authorization.readableScopes()
          return Object.entries(scopes)
            .filter(([typeId]) =>
              modelTypeAccepts(Model, typeId, traversal.target.from.typeId)
            )
            .map(([objectType, visibleWithin]) => ({
              objectType,
              visibleWithin,
            }))
        }
      ),
      authorize: Effect.fn("@company/LinkService.authorize")(
        function* (request) {
          if (request.operation !== "initialize") {
            yield* authorization.requireOperation({
              operationId: request.operation === "list" ? "get" : "update",
              objectType: request.source.id,
              recordIds: [request.sourceId],
            })
          }
          if (request.targetId === undefined) return undefined
          const rowFields = {
            objectType: Storage.core.objects.columns.objectType,
          }
          const [target] = yield* sql<
            SelectionRow<typeof rowFields>
          >`select ${projection(rowFields)}
          from ${Storage.core.objects}
          where ${Storage.core.objects.columns.id} = ${request.targetId}
          limit ${1}`
          if (target === undefined) {
            return yield* Effect.fail(
              new ObjectNotFound({
                objectType: request.traversal.target.from.typeId,
                recordId: request.targetId,
              })
            )
          }
          if (
            request.operation === "initialize" &&
            !request.traversal.writable
          ) {
            yield* authorization.requireOperation({
              operationId: "update",
              objectType: target.objectType,
              recordIds: [request.targetId],
            })
          }
          yield* authorization.requireOperation({
            operationId: "get",
            objectType: target.objectType,
            recordIds: [request.targetId],
          })
          return undefined
        }
      ),
    },
    (object, request, visibility) => {
      const targetRepository = Object.entries(records).find(
        ([id]) => id === object.id
      )?.[1]
      if (!targetRepository)
        return Effect.die(`Unknown object repository '${object.id}'.`)
      // The registry and object are projections of the same closed model.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const reader = targetRepository as unknown as Repository<
        ObjectType,
        PostgresRepositoryError | AssetPrecondition
      >
      return reader.list(request, visibility)
    }
  )
})

/** Validated Link writes for custom Actions that already established authority. */
export const makeLinkWriter = Effect.gen(function* () {
  const database = yield* Database
  const identifiers = yield* RecordIdentifierResolver
  const pageTokens = yield* PageTokens
  return makeRuntimeLinkWriter(
    Model,
    trackedLinkRepository(database, pageTokens),
    { resolve: identifiers.resolve }
  )
})

/** Governed execution for every model-derived Link traversal. */
export class Links extends Context.Service<Links>()("@company/Links", {
  make,
}) {
  static readonly layer = Layer.effect(this, this.make)
}
