import { Context, Effect, Layer } from "effect"

import { modelTypeAccepts } from "#/model/index.ts"
import { Authorization } from "#/server/authorization/authorization-service.ts"
import { Database } from "#/server/database/database.ts"
import { makeEventWriter } from "#/server/events/event-writer.ts"
import {
  makeLinkService,
  makeLinkWriter as makeRuntimeLinkWriter,
} from "#/server/link-service.ts"
import { ModelContext } from "#/server/model-context.ts"
import { ObjectRepositories } from "#/server/model/object-repositories.ts"
import { RecordIdentifierResolver } from "#/server/model/record-identifier-resolver.ts"
import { ObjectNotFound } from "#/server/object-repository.ts"
import { PageTokens } from "#/server/page-tokens.ts"
import {
  projection,
  type SelectionRow,
  inValues,
  sqlValue,
} from "#/server/postgres/index.ts"
import { makeLinkRepository } from "#/server/postgres/index.ts"

function trackedLinkRepository(
  database: typeof Database.Service,
  pageTokens: typeof PageTokens.Service,
  context: typeof ModelContext.Service
) {
  const { model: Model, storage: Storage } = context
  const sql = database.sql

  const repository = makeLinkRepository(Storage, database, pageTokens)
  const events = makeEventWriter(database, context)
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
  const context = yield* ModelContext
  const { model: Model, storage: Storage } = context
  const authorization = yield* Authorization
  const database = yield* Database
  const sql = database.sql
  const identifiers = yield* RecordIdentifierResolver
  const pageTokens = yield* PageTokens
  const repository = trackedLinkRepository(database, pageTokens, context)
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
      const reader = records.get(object)
      return reader.list(request, visibility)
    }
  )
})

/** Validated Link writes for custom Actions that already established authority. */
export const makeLinkWriter = Effect.gen(function* () {
  const context = yield* ModelContext
  const Model = context.model
  const database = yield* Database
  const identifiers = yield* RecordIdentifierResolver
  const pageTokens = yield* PageTokens
  return makeRuntimeLinkWriter(
    Model,
    trackedLinkRepository(database, pageTokens, context),
    { resolve: identifiers.resolve }
  )
})

/** Governed execution for every model-derived Link traversal. */
export class Links extends Context.Service<Links>()("@company/Links", {
  make,
}) {
  static readonly layer = Layer.effect(this, this.make)
}
