import {
  type PageToken,
  type PageTokenCodec,
  type ModelCatalog,
  type ObjectRef,
} from "@company/runtime"
import {
  InvalidLinkListRequest,
  LinkCardinalityConflict,
  type LinkRepository,
} from "@company/runtime/effect/link-repository"
import {
  and,
  asc,
  count,
  eq,
  getTableColumns,
  gt,
  inArray,
  or,
  sql,
} from "drizzle-orm"
import type { AnyRelations } from "drizzle-orm"
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core/errors"
import type { EffectPgDatabase } from "drizzle-orm/effect-postgres"
import type {
  AnyPgColumn,
  AnyPgTable,
  PgInsertValue,
} from "drizzle-orm/pg-core"
import { Effect, Schema } from "effect"
import type { SqlError } from "effect/unstable/sql/SqlError"

import type { PostgresStorage } from "./schema"

interface LinkCursor {
  readonly fingerprint: string
  readonly id: string
  readonly version: 1
}

const linkCursorSchema = Schema.Struct({
  fingerprint: Schema.String,
  id: Schema.String.check(Schema.isNonEmpty()),
  version: Schema.Literal(1),
})

const linkRowsSchema = Schema.Array(
  Schema.Struct({ id: Schema.String, objectType: Schema.String })
)

export type PostgresLinkRepositoryError =
  | EffectDrizzleQueryError
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
  id: string
): PageToken {
  return pageTokens.encode(
    JSON.stringify({ fingerprint, id, version: 1 } satisfies LinkCursor)
  )
}

function decodeCursor(
  linkId: string,
  pageTokens: PageTokenCodec,
  token: PageToken,
  fingerprint: string
): Effect.Effect<string, InvalidLinkListRequest> {
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
        ? Effect.succeed(cursor.id)
        : Effect.fail(
            new InvalidLinkListRequest({
              linkId,
              message: "The page token does not match this list request.",
            })
          )
    )
  )
}

function linkColumn(table: AnyPgTable, key: string): AnyPgColumn {
  const value = getTableColumns(table)[key]
  if (value === undefined) {
    throw new Error(`Link storage column '${key}' is missing.`)
  }
  return value
}

/** Builds the PostgreSQL edge repository for every Link in one closed model. */
export function makeLinkRepository<
  const TModel extends ModelCatalog,
  const TRelations extends AnyRelations,
>(
  storage: PostgresStorage<TModel>,
  db: EffectPgDatabase<TRelations>,
  pageTokens: PageTokenCodec
): LinkRepository<PostgresLinkRepositoryError> {
  const definition = (linkId: string) => {
    const link = storage.model.links[linkId]
    // SAFETY: PostgresStorage materializes each model Link as an AnyPgTable.
    const table = storage.linkTables[linkId] as AnyPgTable | undefined
    if (link === undefined || table === undefined) {
      throw new Error(`Link '${linkId}' does not have PostgreSQL storage.`)
    }
    return { link, table }
  }

  return {
    link: Effect.fn("@company/postgres/LinkRepository.link")(function* (pair) {
      const { link, table } = definition(pair.linkId)
      const sourceKey = pair.direction === "forward" ? "forwardId" : "reverseId"
      const targetKey = pair.direction === "forward" ? "reverseId" : "forwardId"
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
      } as PgInsertValue<AnyPgTable>
      return yield* db.transaction((tx) =>
        Effect.gen(function* () {
          const exactPair = and(
            eq(sourceColumn, pair.sourceId),
            eq(targetColumn, pair.targetId)
          )
          const [existingPair] = yield* tx
            .select({ targetId: targetColumn })
            .from(table)
            .where(exactPair)
            .limit(1)
          if (existingPair !== undefined) return undefined

          if (sourceTraversal.cardinality !== "many") {
            const [sourceConflict] = yield* tx
              .select({ targetId: targetColumn })
              .from(table)
              .where(eq(sourceColumn, pair.sourceId))
              .limit(1)
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
              yield* tx.delete(table).where(eq(sourceColumn, pair.sourceId))
            }
          }

          if (targetTraversal.cardinality !== "many") {
            const [targetConflict] = yield* tx
              .select({ sourceId: sourceColumn })
              .from(table)
              .where(eq(targetColumn, pair.targetId))
              .limit(1)
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
              yield* tx.delete(table).where(eq(targetColumn, pair.targetId))
            }
          }

          const inserted = yield* tx
            .insert(table)
            .values(values)
            .onConflictDoNothing()
            .returning({ sourceId: sourceColumn })
          if (inserted.length > 0) return undefined

          const [concurrentPair] = yield* tx
            .select({ targetId: targetColumn })
            .from(table)
            .where(exactPair)
            .limit(1)
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
    }),

    list: Effect.fn("@company/postgres/LinkRepository.list")(
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
              : or(
                  ...visibility.targets.map(({ objectType, visibleWithin }) =>
                    and(
                      eq(storage.core.objects.objectType, objectType),
                      visibleWithin.length === 0
                        ? sql`false`
                        : or(
                            inArray(targetColumn, visibleWithin),
                            sql`${storage.core.objects.ancestorIds} && array[${sql.join(
                              visibleWithin.map((scopeId) => sql`${scopeId}`),
                              sql`, `
                            )}]::text[]`
                          )
                    )
                  )
                )
        const matching = and(
          eq(sourceColumn, request.sourceId),
          targetVisibility
        )
        const rows = yield* db
          .select({
            id: targetColumn,
            objectType: storage.core.objects.objectType,
          })
          .from(table)
          .innerJoin(
            storage.core.objects,
            eq(targetColumn, storage.core.objects.id)
          )
          .where(
            and(
              matching,
              after === undefined ? undefined : gt(targetColumn, after)
            )
          )
          .orderBy(asc(targetColumn))
          .limit(request.pageSize + 1)
        const hasMore = rows.length > request.pageSize
        const pageRows = yield* Schema.decodeUnknownEffect(linkRowsSchema)(
          rows.slice(0, request.pageSize)
        )
        const last = pageRows.at(-1)
        const totalSize =
          request.pageToken === undefined && !hasMore
            ? pageRows.length
            : ((visibility === undefined
                ? yield* db
                    .select({ totalSize: count() })
                    .from(table)
                    .where(eq(sourceColumn, request.sourceId))
                : yield* db
                    .select({ totalSize: count() })
                    .from(table)
                    .innerJoin(
                      storage.core.objects,
                      eq(targetColumn, storage.core.objects.id)
                    )
                    .where(matching))[0]?.totalSize ?? 0)
        return {
          items: pageRows.map(({ id, objectType }): ObjectRef => ({
            // SAFETY: the target column is a foreign key to the same core row
            // that supplied objectType, so this pair is a valid ObjectRef.
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion
            id: id as ObjectRef["id"],
            objectType,
          })),
          nextPageToken:
            hasMore && last !== undefined
              ? encodeCursor(pageTokens, fingerprint, last.id)
              : null,
          totalSize,
        }
      }
    ),

    unlink: Effect.fn("@company/postgres/LinkRepository.unlink")(
      function* (pair) {
        const { table } = definition(pair.linkId)
        yield* db
          .delete(table)
          .where(
            and(
              eq(
                linkColumn(
                  table,
                  pair.direction === "forward" ? "forwardId" : "reverseId"
                ),
                pair.sourceId
              ),
              eq(
                linkColumn(
                  table,
                  pair.direction === "forward" ? "reverseId" : "forwardId"
                ),
                pair.targetId
              )
            )
          )
        return undefined
      }
    ),
  }
}
import { createHash } from "node:crypto"
