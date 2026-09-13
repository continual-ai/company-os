import { Effect } from "effect"

import { resolveListRequest } from "#/runtime/contract/object-input.ts"
import {
  modelTypeAccepts,
  type InterfaceType,
  type ModelCatalog,
  type PageTokenCodec,
} from "#/runtime/model/index.ts"
import type { LinkListInput } from "#/runtime/model/link-input.ts"
import { InvalidListRequest } from "#/runtime/server/errors.ts"
import type { RecordIdentifiers } from "#/runtime/server/storage/identifiers.ts"
import {
  cursorCondition,
  cursorFingerprint,
  decodeCursor,
  encodeCursor,
  makeObjectQueryCompiler,
  orderExpression,
} from "#/runtime/server/storage/object-query.ts"
import { relationalQuery } from "#/runtime/server/storage/relational-query.ts"
import type { PostgresStorage } from "#/runtime/server/storage/schema.ts"
import {
  tableColumns,
  quoteIdentifier as q,
  type Column,
} from "#/runtime/server/storage/table.ts"
import type { SqlDatabase } from "#/runtime/server/storage/transactions.ts"

/** A query-only union exposes the Interface's declared fields without copying their storage. */
export function interfaceQuery(
  storage: PostgresStorage<ModelCatalog>,
  database: typeof SqlDatabase.Service,
  pageTokens: PageTokenCodec,
  identifiers: typeof RecordIdentifiers.Service
) {
  const sql = database.sql
  return Effect.fn("@company/Links.interfaceQuery")(function* (
    target: InterfaceType,
    input: LinkListInput,
    relatedTo: {
      readonly direction: "forward" | "reverse"
      readonly linkId: string
      readonly sourceId: string
    },
    pageSize: number
  ) {
    const columns: Record<string, Column> = {}
    const branches = Object.values(storage.model.objects)
      .filter((candidate) =>
        modelTypeAccepts(storage.model, candidate.id, target.id)
      )
      .map((candidate) => {
        const table = storage.objects[candidate.id]!
        const core = storage.core.objects
        const mapping = candidate.interfaces[target.id]!.propertyMapping
        const fields = {
          ...Object.fromEntries(
            Object.keys(target.properties).map((key) => [
              key,
              tableColumns(table)[mapping[key] ?? key]!,
            ])
          ),
          id: core.columns.id,
          objectType: core.columns.objectType,
          createdAt: core.columns.createdAt,
          updatedAt: core.columns.updatedAt,
          createdBy: core.columns.createdById,
          updatedBy: core.columns.updatedById,
          systemManaged: core.columns.systemManaged,
        }
        const edge = storage.linkTables[relatedTo.linkId]!
        const source =
          relatedTo.direction === "forward"
            ? edge.columns.forwardId
            : edge.columns.reverseId
        const destination =
          relatedTo.direction === "forward"
            ? edge.columns.reverseId
            : edge.columns.forwardId
        for (const [key, field] of Object.entries(fields))
          columns[key] = Object.assign(
            sql.literal(`related_records.${q(key)}`),
            { name: key, type: field.type }
          )
        return sql`select ${sql.csv(Object.entries(fields).map(([key, field]) => sql`${field} as ${sql.literal(q(key))}`))} from ${table} join ${core} on ${table.columns.id} = ${core.columns.id} where exists (select 1 from ${edge} where ${source} = ${relatedTo.sourceId} and ${destination} = ${core.columns.id})`
      })
    if (branches.length === 0)
      return { items: [], nextPageToken: null, totalSize: 0 }
    const request = yield* resolveListRequest(
      target,
      input,
      identifiers.resolveAliases,
      storage.model
    )
    const compiled = yield* Effect.try({
      try: () => {
        const related = relationalQuery(sql, storage, target, columns.id!)
        const compiler = makeObjectQueryCompiler(
          sql,
          target,
          columns,
          related.filter,
          related.field
        )
        const sort = compiler.resolveSort(request)
        const fingerprint = cursorFingerprint(
          target,
          { ...request, relatedTo },
          sort
        )
        const cursor =
          request.pageToken === undefined
            ? undefined
            : decodeCursor(
                target,
                pageTokens,
                request.pageToken,
                fingerprint,
                sort.length
              )
        return {
          sort,
          fingerprint,
          filter:
            request.filter === undefined
              ? sql`true`
              : compiler.compileFilter(request.filter),
          after:
            cursor === undefined
              ? sql`true`
              : (cursorCondition(sql, sort, cursor.values) ?? sql`true`),
        }
      },
      catch: (error) =>
        error instanceof InvalidListRequest
          ? error
          : new InvalidListRequest({
              objectType: target.id,
              message: "The relationship query is invalid.",
            }),
    })
    const from = sql`(${sql.join(" union all ")(branches)}) related_records`
    const rows = yield* sql<{
      id: string
      objectType: string
      values: ReadonlyArray<string | null>
    }>`select ${columns.id}, ${columns.objectType}, jsonb_build_array(${sql.csv(compiled.sort.map(({ column }) => sql`${column}::text`))}) as values from ${from} where ${compiled.filter} and ${compiled.after} order by ${sql.csv(compiled.sort.map((sort) => orderExpression(sql, sort)))} limit ${pageSize + 1}`
    const items = rows.slice(0, pageSize)
    const count = yield* sql<{
      totalSize: number
    }>`select count(*)::double precision as "totalSize" from ${from} where ${compiled.filter}`
    const last = items.at(-1)
    return {
      items: items.map(({ id, objectType }) => ({ id, objectType })),
      totalSize: count[0]!.totalSize,
      nextPageToken:
        rows.length > pageSize && last
          ? encodeCursor(pageTokens, {
              fingerprint: compiled.fingerprint,
              values: last.values,
              version: 1,
            })
          : null,
    }
  })
}
