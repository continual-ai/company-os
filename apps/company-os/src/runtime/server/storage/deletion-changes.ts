import { Data, Effect } from "effect"

import { SYSTEM_SERVICE_ACCOUNT_ID } from "#/runtime/model/system-records.ts"
import { makeEventWriter } from "#/runtime/server/events/event-writer.ts"
import { currentActorId } from "#/runtime/server/invocation-context.ts"
import type { ModelContext } from "#/runtime/server/model-context.ts"
import type { Database } from "#/runtime/server/storage/database.ts"
import {
  inValues,
  projection,
  type SelectionRow,
} from "#/runtime/server/storage/statement.ts"

export class CascadeDeleteRestricted extends Data.TaggedError(
  "CascadeDeleteRestricted"
)<{
  readonly recordId: string
}> {}

/** Resolve explicit ownership, journal removed edges, then delete owned records in the same transaction. */
export function deletionChanges(
  database: typeof Database.Service,
  context: typeof ModelContext.Service
) {
  const { model, storage } = context
  const sql = database.sql
  const objects = storage.core.objects
  const links = Object.values(model.links).sort((a, b) =>
    a.id.localeCompare(b.id)
  )
  const cascadeEdges = links.flatMap((link) =>
    (["forward", "reverse"] as const).flatMap((side) => {
      if (link[side].onDelete !== "cascade") return []
      const table = storage.linkTables[link.id]!
      const source =
        side === "forward" ? table.columns.forwardId : table.columns.reverseId
      const target =
        side === "forward" ? table.columns.reverseId : table.columns.forwardId
      return [
        sql`select ${source} as source_id, ${target} as target_id from ${table}`,
      ]
    })
  )
  return (ids: ReadonlyArray<string>) =>
    Effect.gen(function* () {
      if (ids.length === 0) return []
      // Stable ordering makes graph discovery and edge removal atomic with concurrent link writers.
      for (const link of links)
        yield* sql`select pg_advisory_xact_lock(hashtextextended(${`link:${link.id}`}, 0))`
      const edges =
        cascadeEdges.length === 0
          ? sql`select null::text as source_id, null::text as target_id where false`
          : sql.join(" union all ")(cascadeEdges)
      const owned = yield* sql<{
        id: string
      }>`with recursive edges as (${edges}), owned(id) as (
      select ${objects.columns.id} from ${objects} where ${inValues(sql, objects.columns.id, ids)}
      union select edges.target_id from edges join owned on edges.source_id = owned.id
    ) select id from owned`
      const allIds = owned.map((row) => row.id)
      if (allIds.length === 0) return []
      const fields = {
        id: objects.columns.id,
        objectType: objects.columns.objectType,
        etag: objects.columns.etag,
        systemManaged: objects.columns.systemManaged,
      }
      const targets = yield* sql<
        SelectionRow<typeof fields>
      >`select ${projection(fields)} from ${objects}
      where ${inValues(sql, objects.columns.id, allIds)} order by ${objects.columns.id} for update`
      const roots = new Set(ids)
      const children = targets.filter((row) => !roots.has(row.id))
      const actor = yield* currentActorId
      for (const target of children)
        if (target.systemManaged && actor !== SYSTEM_SERVICE_ACCOUNT_ID)
          return yield* Effect.fail(
            new CascadeDeleteRestricted({ recordId: target.id })
          )
      const events = makeEventWriter(database, context)
      const touched = new Set<string>()
      for (const link of links) {
        const table = storage.linkTables[link.id]!
        const pairFields = {
          forwardId: table.columns.forwardId,
          reverseId: table.columns.reverseId,
        }
        const pairs = yield* sql<
          SelectionRow<typeof pairFields>
        >`select ${projection(pairFields)} from ${table}
        where ${inValues(sql, table.columns.forwardId, allIds)} or ${inValues(sql, table.columns.reverseId, allIds)}`
        for (const pair of pairs) {
          touched.add(pair.forwardId)
          touched.add(pair.reverseId)
          yield* events.record({
            type: `${link.id}.unlinked`,
            subjects: yield* events.subjects([pair.forwardId, pair.reverseId]),
            data: { link: link.id },
          })
        }
      }
      const deleted = new Set(allIds)
      const surviving = [...touched].filter((id) => !deleted.has(id))
      if (surviving.length > 0)
        yield* sql`update ${objects} set etag = (etag::numeric + 1)::text, updated_at = now(), updated_by_id = ${actor} where ${inValues(sql, objects.columns.id, surviving)}`
      if (children.length > 0)
        yield* sql`delete from ${objects} where ${inValues(
          sql,
          objects.columns.id,
          children.map((child) => child.id)
        )}`
      return children
    })
}
