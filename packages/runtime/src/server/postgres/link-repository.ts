import { Effect, Schema } from "effect"
import type { SqlError } from "effect/unstable/sql/SqlError"

import { RecordId } from "#/model/index.ts"
import {
  type PageToken,
  type PageTokenCodec,
  type ModelCatalog,
  type ObjectRef,
} from "#/model/index.ts"
import {
  InvalidLinkListRequest,
  LinkCardinalityConflict,
  type LinkRepository,
} from "#/server/link-repository.ts"
import { type PostgresDatabase } from "#/server/postgres/database.ts"
import type { PostgresStorage } from "#/server/postgres/schema.ts"
import { insertValues } from "#/server/postgres/statement.ts"
import {
  projection,
  type SelectionRow,
  inValues,
  sqlValue,
} from "#/server/postgres/statement.ts"
import {
  tableColumns,
  type Column,
  type Table,
} from "#/server/postgres/table.ts"

interface LinkCursor {
  readonly fingerprint: string
  readonly id: string
  readonly createdAt: string
  readonly version: 2
}

const linkCursorSchema = Schema.Struct({
  fingerprint: Schema.String,
  id: Schema.String.check(Schema.isNonEmpty()),
  createdAt: Schema.String.check(Schema.isNonEmpty()),
  version: Schema.Literal(2),
})

const linkRowsSchema = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    objectType: Schema.String,
    createdAt: Schema.String,
  })
)

export type PostgresLinkRepositoryError =
  | InvalidLinkListRequest
  | Schema.SchemaError
  | SqlError

function cursorFingerprint(request: {
  readonly direction: "forward" | "reverse"
  readonly linkId: string
  readonly sourceId: string
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        direction: request.direction,
        linkId: request.linkId,
        sourceId: request.sourceId,
      })
    )
    .digest()
    .subarray(0, 16)
    .toString("base64url")
}

function encodeCursor(
  pageTokens: PageTokenCodec,
  fingerprint: string,
  id: string,
  createdAt: string
): PageToken {
  return pageTokens.encode(
    JSON.stringify({
      fingerprint,
      id,
      createdAt,
      version: 2,
    } satisfies LinkCursor)
  )
}

function decodeCursor(
  linkId: string,
  pageTokens: PageTokenCodec,
  token: PageToken,
  fingerprint: string
): Effect.Effect<LinkCursor, InvalidLinkListRequest> {
  return Effect.try({
    try: () => JSON.parse(pageTokens.decode(token)),
    catch: () =>
      new InvalidLinkListRequest({
        linkId,
        message: "The page token is invalid.",
      }),
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(linkCursorSchema)),
    Effect.mapError(
      () =>
        new InvalidLinkListRequest({
          linkId,
          message: "The page token is invalid.",
        })
    ),
    Effect.flatMap((cursor) =>
      cursor.fingerprint === fingerprint
        ? Effect.succeed(cursor)
        : Effect.fail(
            new InvalidLinkListRequest({
              linkId,
              message: "The page token does not match this list request.",
            })
          )
    )
  )
}

function linkColumn(
  table: Table<{ forwardId: string; reverseId: string }>,
  key: "forwardId" | "reverseId"
): Column<string> {
  const value = tableColumns(table)[key]
  if (value === undefined) {
    throw new Error(`Link storage column '${key}' is missing.`)
  }
  return value
}

/** Builds the PostgreSQL edge repository for every Link in one closed model. */
export function makeLinkRepository<const TModel extends ModelCatalog>(
  storage: PostgresStorage<TModel>,
  db: PostgresDatabase,
  pageTokens: PageTokenCodec
): LinkRepository<PostgresLinkRepositoryError> {
  const sql = db.sql
  const definition = (linkId: string) => {
    const link = storage.model.links[linkId]
    // SAFETY: PostgresStorage materializes each model Link as a Table.
    const table = storage.linkTables[linkId] as
      | Table<{ forwardId: string; reverseId: string }>
      | undefined
    if (link === undefined || table === undefined) {
      throw new Error(`Link '${linkId}' does not have PostgreSQL storage.`)
    }
    return { link, table }
  }

  const repository: LinkRepository<PostgresLinkRepositoryError> = {
    link: Effect.fn("@company/runtime/postgres/LinkRepository.link")(
      function* (pair) {
        const { link, table } = definition(pair.linkId)
        const sourceKey =
          pair.direction === "forward" ? "forwardId" : "reverseId"
        const targetKey =
          pair.direction === "forward" ? "reverseId" : "forwardId"
        const sourceColumn = linkColumn(table, sourceKey)
        const targetColumn = linkColumn(table, targetKey)
        const sourceTraversal =
          pair.direction === "forward" ? link.forward : link.reverse
        const targetTraversal =
          pair.direction === "forward" ? link.reverse : link.forward
        // SAFETY: sourceKey and targetKey are the two required columns verified above.
        const values = {
          [sourceKey]: pair.sourceId,
          [targetKey]: pair.targetId,
        }
        return yield* db.transaction(() =>
          Effect.gen(function* () {
            // A subset selection also establishes membership in its containing relationship.
            if (link.subsetOf !== undefined)
              yield* repository.link({ ...pair, linkId: link.subsetOf })
            const exactPair = sql`(${sourceColumn} = ${pair.sourceId} and ${targetColumn} = ${pair.targetId})`
            const rowFields = { targetId: targetColumn }
            const [existingPair] = yield* sql<
              SelectionRow<typeof rowFields>
            >`select ${projection(rowFields)}
          from ${table}
          where ${exactPair}
          limit ${1}`
            if (existingPair !== undefined) return undefined

            if (sourceTraversal.cardinality !== "many") {
              const rowFields2 = { targetId: targetColumn }
              const [sourceConflict] = yield* sql<
                SelectionRow<typeof rowFields2>
              >`select ${projection(rowFields2)}
          from ${table}
          where ${sourceColumn} = ${pair.sourceId}
          limit ${1}`
              if (sourceConflict !== undefined) {
                if (targetTraversal.cardinality === "one") {
                  return yield* Effect.fail(
                    new LinkCardinalityConflict({
                      linkId: pair.linkId,
                      sourceId: pair.sourceId,
                      targetId: pair.targetId,
                    })
                  )
                }
                yield* sql`delete
          from ${table}
          where ${sourceColumn} = ${pair.sourceId}`
              }
            }

            if (targetTraversal.cardinality !== "many") {
              const rowFields3 = { sourceId: sourceColumn }
              const [targetConflict] = yield* sql<
                SelectionRow<typeof rowFields3>
              >`select ${projection(rowFields3)}
          from ${table}
          where ${targetColumn} = ${pair.targetId}
          limit ${1}`
              if (targetConflict !== undefined) {
                if (sourceTraversal.cardinality === "one") {
                  return yield* Effect.fail(
                    new LinkCardinalityConflict({
                      linkId: pair.linkId,
                      sourceId: pair.sourceId,
                      targetId: pair.targetId,
                    })
                  )
                }
                yield* sql`delete
          from ${table}
          where ${targetColumn} = ${pair.targetId}`
              }
            }

            const insertedFields = { sourceId: sourceColumn }
            const inserted = yield* sql<
              SelectionRow<typeof insertedFields>
            >`insert into ${table} ${insertValues(sql, table, values)}
          on conflict do nothing
          returning ${projection(insertedFields)}`
            if (inserted.length > 0) return undefined

            const rowFields4 = { targetId: targetColumn }
            const [concurrentPair] = yield* sql<
              SelectionRow<typeof rowFields4>
            >`select ${projection(rowFields4)}
          from ${table}
          where ${exactPair}
          limit ${1}`
            if (concurrentPair !== undefined) return undefined
            return yield* Effect.fail(
              new LinkCardinalityConflict({
                linkId: pair.linkId,
                sourceId: pair.sourceId,
                targetId: pair.targetId,
              })
            )
          })
        )
      }
    ),

    list: Effect.fn("@company/runtime/postgres/LinkRepository.list")(
      function* (request, visibility) {
        const { table } = definition(request.linkId)
        const sourceColumn = linkColumn(
          table,
          request.direction === "forward" ? "forwardId" : "reverseId"
        )
        const targetColumn = linkColumn(
          table,
          request.direction === "forward" ? "reverseId" : "forwardId"
        )
        const fingerprint = cursorFingerprint(request)
        const after =
          request.pageToken === undefined
            ? undefined
            : yield* decodeCursor(
                request.linkId,
                pageTokens,
                request.pageToken,
                fingerprint
              )
        const targetVisibility =
          visibility === undefined
            ? undefined
            : visibility.targets.length === 0
              ? sql`false`
              : sql.join(
                  " OR ",
                  true,
                  "false"
                )(
                  visibility.targets
                    .map(({ objectType, visibleWithin }) =>
                      sql.and(
                        [
                          sql`${storage.core.objects.columns.objectType} = ${objectType}`,
                          visibleWithin.length === 0
                            ? sql`false`
                            : sql`(${inValues(sql, targetColumn, visibleWithin)} or ${storage.core.objects.columns.ancestorIds} && array[${sql.join(", ", false)(visibleWithin.map((scopeId) => sql`${scopeId}`))}]::text[])`,
                        ].filter((part) => part !== undefined)
                      )
                    )
                    .filter((part) => part !== undefined)
                )
        const matching = sql.and(
          [sql`${sourceColumn} = ${request.sourceId}`, targetVisibility].filter(
            (part) => part !== undefined
          )
        )
        const rowsFields = {
          id: targetColumn,
          objectType: storage.core.objects.columns.objectType,
          createdAt: sqlValue<string>(
            sql`${storage.core.objects.columns.createdAt}::text`
          ),
        }
        const rows = yield* sql<
          SelectionRow<typeof rowsFields>
        >`select ${projection(rowsFields)}
          from ${table}
          inner join ${storage.core.objects} on ${targetColumn} = ${storage.core.objects.columns.id}
          where ${sql.and(
            [
              matching,
              after === undefined
                ? undefined
                : sql`(${storage.core.objects.columns.createdAt}, ${targetColumn}) < (${after.createdAt}::timestamptz, ${after.id})`,
            ].filter((part) => part !== undefined)
          )}
          order by ${sql.csv([sql`${storage.core.objects.columns.createdAt} desc`, sql`${targetColumn} desc`])}
          limit ${request.pageSize + 1}`
        const hasMore = rows.length > request.pageSize
        const pageRows = yield* Schema.decodeUnknownEffect(linkRowsSchema)(
          rows.slice(0, request.pageSize)
        )
        const last = pageRows.at(-1)
        const totalSizeFields = {
          totalSize: sqlValue<number>(sql`count(*)::double precision`),
        }
        const totalSize =
          request.pageToken === undefined && !hasMore
            ? pageRows.length
            : ((visibility === undefined
                ? yield* sql<
                    SelectionRow<typeof totalSizeFields>
                  >`select ${projection(totalSizeFields)}
          from ${table}
          where ${sourceColumn} = ${request.sourceId}`
                : yield* sql<
                    SelectionRow<typeof totalSizeFields>
                  >`select ${projection(totalSizeFields)}
          from ${table}
          inner join ${storage.core.objects} on ${targetColumn} = ${storage.core.objects.columns.id}
          where ${matching}`)[0]?.totalSize ?? 0)
        return {
          items: pageRows.map(({ id, objectType }): ObjectRef => ({
            // SAFETY: the target column is a foreign key to the same core row
            // that supplied objectType, so this pair is a valid ObjectRef.
            id: RecordId(objectType)(id),
            objectType,
          })),
          nextPageToken:
            hasMore && last !== undefined
              ? encodeCursor(pageTokens, fingerprint, last.id, last.createdAt)
              : null,
          totalSize,
        }
      }
    ),

    unlink: Effect.fn("@company/runtime/postgres/LinkRepository.unlink")(
      function* (pair) {
        const { table } = definition(pair.linkId)
        yield* sql`delete
          from ${table}
          where (${linkColumn(
            table,
            pair.direction === "forward" ? "forwardId" : "reverseId"
          )} = ${pair.sourceId} and ${linkColumn(
            table,
            pair.direction === "forward" ? "reverseId" : "forwardId"
          )} = ${pair.targetId})`
        return undefined
      }
    ),
  }
  return repository
}
import { createHash } from "node:crypto"
