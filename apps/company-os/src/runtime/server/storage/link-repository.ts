import { createHash } from "node:crypto"

import { Data, Effect, Schema } from "effect"
import type { SqlError } from "effect/unstable/sql/SqlError"
import type { Fragment } from "effect/unstable/sql/Statement"

import {
  RecordId,
  type LinkDirection,
  type ModelCatalog,
  type ObjectRef,
  type PageToken,
  type PageTokenCodec,
} from "#/runtime/model/index.ts"
import { type PostgresDatabase } from "#/runtime/server/storage/database.ts"
import type { PostgresStorage } from "#/runtime/server/storage/schema.ts"
import {
  insertValues,
  projection,
  sqlValue,
  type SelectionRow,
} from "#/runtime/server/storage/statement.ts"
import {
  tableColumns,
  type Column,
  type Table,
} from "#/runtime/server/storage/table.ts"

export class LinkCardinalityConflict extends Data.TaggedError(
  "LinkCardinalityConflict"
)<{
  readonly linkId: string
  readonly sourceId: string
  readonly targetId: string
}> {}

export class InvalidLinkListRequest extends Data.TaggedError(
  "InvalidLinkListRequest"
)<{
  readonly linkId: string
  readonly message: string
}> {}

export interface LinkPair {
  readonly direction: LinkDirection
  readonly linkId: string
  readonly sourceId: string
  readonly targetId: string
}

export interface LinkListRequest {
  readonly direction: LinkDirection
  readonly linkId: string
  readonly pageSize: number
  readonly pageToken?: PageToken
  readonly sourceId: string
}

/** One edge explicitly inserted or removed by a mutation. */
export interface LinkChange {
  readonly kind: "linked" | "unlinked"
  readonly linkId: string
  readonly forwardId: string
  readonly reverseId: string
}

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

type LinkTable = Table<{ forwardId: string; reverseId: string }>

function linkColumn(
  table: LinkTable,
  key: "forwardId" | "reverseId"
): Column<string> {
  const value = tableColumns(table)[key]
  if (value === undefined) {
    throw new Error(`Link storage column '${key}' is missing.`)
  }
  return value
}

/**
 * Builds the PostgreSQL edge repository for every Link in one closed model.
 * Mutations report exactly the edges they changed so callers can journal them;
 * they assume the caller holds the transaction and any row locks.
 */
export function makeLinkRepository<const TModel extends ModelCatalog>(
  storage: PostgresStorage<TModel>,
  db: PostgresDatabase,
  pageTokens: PageTokenCodec
) {
  const sql = db.sql
  const definition = (linkId: string) => {
    const link = storage.model.links[linkId]
    // SAFETY: PostgresStorage materializes each model Link as a Table.
    const table = storage.linkTables[linkId] as LinkTable | undefined
    if (link === undefined || table === undefined) {
      throw new Error(`Link '${linkId}' does not have PostgreSQL storage.`)
    }
    return { link, table }
  }
  // Storage cascades subset rows when their membership row disappears; removing them
  // first, with the same predicate, reports every edge the cascade would have erased.
  const removeEdges = (
    linkId: string,
    condition: (table: LinkTable) => Fragment
  ): Effect.Effect<ReadonlyArray<LinkChange>, SqlError> =>
    Effect.gen(function* () {
      const changes: Array<LinkChange> = []
      const { table } = definition(linkId)
      const removedFields = {
        forwardId: linkColumn(table, "forwardId"),
        reverseId: linkColumn(table, "reverseId"),
      }
      const removed = yield* sql<SelectionRow<typeof removedFields>>`delete
          from ${table}
          where ${condition(table)}
          returning ${projection(removedFields)}`
      for (const edge of removed)
        changes.push({ kind: "unlinked", linkId, ...edge })
      return changes
    })

  /** Idempotently establishes one edge. Bounds are enforced by the database. */
  const link = Effect.fn("@company/runtime/storage/LinkRepository.link")(
    function* (
      pair: LinkPair
    ): Effect.fn.Return<
      ReadonlyArray<LinkChange>,
      LinkCardinalityConflict | SqlError
    > {
      const { table } = definition(pair.linkId)
      const sourceKey = pair.direction === "forward" ? "forwardId" : "reverseId"
      const targetKey = pair.direction === "forward" ? "reverseId" : "forwardId"
      const sourceColumn = linkColumn(table, sourceKey)
      const targetColumn = linkColumn(table, targetKey)
      const changes: Array<LinkChange> = []
      const exactPair = sql`(${sourceColumn} = ${pair.sourceId} and ${targetColumn} = ${pair.targetId})`
      const rowFields = { targetId: targetColumn }
      const [existingPair] = yield* sql<
        SelectionRow<typeof rowFields>
      >`select ${projection(rowFields)}
          from ${table}
          where ${exactPair}
          limit ${1}`
      if (existingPair !== undefined) return changes

      const insertedFields = {
        forwardId: linkColumn(table, "forwardId"),
        reverseId: linkColumn(table, "reverseId"),
      }
      const inserted = yield* sql<
        SelectionRow<typeof insertedFields>
      >`insert into ${table} ${insertValues(sql, table, {
        [sourceKey]: pair.sourceId,
        [targetKey]: pair.targetId,
      })}
          on conflict do nothing
          returning ${projection(insertedFields)}`
      for (const edge of inserted)
        changes.push({ kind: "linked", linkId: pair.linkId, ...edge })
      if (inserted.length > 0) return changes

      const [concurrentPair] = yield* sql<
        SelectionRow<typeof rowFields>
      >`select ${projection(rowFields)}
          from ${table}
          where ${exactPair}
          limit ${1}`
      if (concurrentPair !== undefined) return changes
      return yield* Effect.fail(
        new LinkCardinalityConflict({
          linkId: pair.linkId,
          sourceId: pair.sourceId,
          targetId: pair.targetId,
        })
      )
    }
  )

  const list = Effect.fn("@company/runtime/storage/LinkRepository.list")(
    function* (request: LinkListRequest) {
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
      const matching = sql`${sourceColumn} = ${request.sourceId}`
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
          : ((yield* sql<
              SelectionRow<typeof totalSizeFields>
            >`select ${projection(totalSizeFields)} from ${table} where ${matching}`)[0]
              ?.totalSize ?? 0)
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
  )

  /** Idempotently removes one edge together with its subset selections. */
  const unlink = Effect.fn("@company/runtime/storage/LinkRepository.unlink")(
    function* (pair: LinkPair) {
      const sourceKey = pair.direction === "forward" ? "forwardId" : "reverseId"
      const targetKey = pair.direction === "forward" ? "reverseId" : "forwardId"
      return yield* removeEdges(
        pair.linkId,
        (table) =>
          sql`(${linkColumn(table, sourceKey)} = ${pair.sourceId} and ${linkColumn(table, targetKey)} = ${pair.targetId})`
      )
    }
  )

  const ids = (pair: Omit<LinkPair, "targetId">) => {
    const { table } = definition(pair.linkId)
    const source = linkColumn(
      table,
      pair.direction === "forward" ? "forwardId" : "reverseId"
    )
    const target = linkColumn(
      table,
      pair.direction === "forward" ? "reverseId" : "forwardId"
    )
    return sql<{
      id: string
    }>`select ${target} as id from ${table} where ${source} = ${pair.sourceId} order by ${target}`.pipe(
      Effect.map((rows) => rows.map((row) => row.id))
    )
  }
  return { link, list, unlink, ids }
}
