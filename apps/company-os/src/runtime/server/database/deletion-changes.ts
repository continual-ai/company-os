import { Effect } from "effect"

import { modelTypeAccepts, type ObjectType } from "#/runtime/model/index.ts"
import type { Database } from "#/runtime/server/database/database.ts"
import { makeEventWriter } from "#/runtime/server/events/event-writer.ts"
import type { ModelContext } from "#/runtime/server/model-context.ts"
import {
  projection,
  type SelectionRow,
  inValues,
  sqlValue,
} from "#/runtime/server/postgres/index.ts"

const cascades = (cardinality: string) => cardinality !== "one"

/** Capture Link endpoints before cascades erase them. Row locks exclude concurrent FK inserts. */
export function deletionChanges(
  database: typeof Database.Service,
  object: ObjectType,
  context: typeof ModelContext.Service
) {
  const { model: Model, storage: Storage } = context
  const sql = database.sql

  const traversals = Object.values(Model.links).flatMap((link) => {
    const table = Storage.linkTables[link.id]!
    return [
      ...(modelTypeAccepts(Model, object.id, link.forward.from.typeId) &&
      cascades(link.reverse.cardinality)
        ? [{ source: table.columns.forwardId, table, linkId: link.id }]
        : []),
      ...(modelTypeAccepts(Model, object.id, link.reverse.from.typeId) &&
      cascades(link.forward.cardinality)
        ? [{ source: table.columns.reverseId, table, linkId: link.id }]
        : []),
    ]
  })
  return (ids: ReadonlyArray<string>) =>
    Effect.gen(function* () {
      if (ids.length === 0 || traversals.length === 0) return
      const objects = Storage.core.objects
      const selection = { id: objects.columns.id }
      yield* sql<SelectionRow<typeof selection>>`select ${projection(selection)}
          from ${objects}
          where ${inValues(sql, objects.columns.id, [...ids])}
          order by ${sql.csv([objects.columns.id])} for update`
      const events = makeEventWriter(database, context)
      const seen = new Set<string>()
      for (const { source, table, linkId } of traversals) {
        const rowsFields = {
          forwardId: sqlValue<string>(sql`${table.columns.forwardId}`),
          reverseId: sqlValue<string>(sql`${table.columns.reverseId}`),
        }
        const rows = yield* sql<
          SelectionRow<typeof rowsFields>
        >`select ${projection(rowsFields)}
          from ${table}
          where ${inValues(sql, source, [...ids])}`
        for (const pair of rows) {
          const key = JSON.stringify([linkId, pair.forwardId, pair.reverseId])
          if (seen.has(key)) continue
          seen.add(key)
          yield* events.record({
            type: `${linkId}.unlinked`,
            subjects: yield* events.subjects([pair.forwardId, pair.reverseId]),
            data: { link: linkId },
          })
        }
      }
    })
}
