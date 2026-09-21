import { Effect } from "effect"

import { SYSTEM_SERVICE_ACCOUNT_ID } from "#/runtime/model/system-records.ts"
import { CascadeDeleteRestricted } from "#/runtime/server/errors.ts"
import { makeEventWriter } from "#/runtime/server/events/event-writer.ts"
import { preserveRecordSnapshots } from "#/runtime/server/events/record-snapshots.ts"
import { currentActorId } from "#/runtime/server/invocation-context.ts"
import type { ModelContext } from "#/runtime/server/model-context.ts"
import {
  inValues,
  projection,
  type SelectionRow,
} from "#/runtime/server/storage/statement.ts"
import type { SqlDatabase } from "#/runtime/server/storage/transactions.ts"

/** Collect and validate the complete deletion before changing records or staging journal facts. */
export function deletionChanges(
  database: typeof SqlDatabase.Service,
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
      const edges =
        cascadeEdges.length === 0
          ? sql`select null::text as source_id, null::text as target_id where false`
          : sql.join(" union all ")(cascadeEdges)
      const visited = new Set<string>()
      let frontier = [...ids]
      while (frontier.length > 0) {
        const locked = yield* sql<{
          id: string
        }>`select id from ${objects} where ${inValues(sql, objects.columns.id, frontier)} order by id for update`
        for (const row of locked) visited.add(row.id)
        const children = yield* sql<{
          id: string
        }>`with edges as (${edges}) select target_id as id from edges where source_id = any(${frontier}::text[])`
        frontier = [...new Set(children.map(({ id }) => id))].filter(
          (id) => !visited.has(id)
        )
      }
      const allIds = [...visited]
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
      const removed: Array<{
        linkId: string
        forwardId: string
        reverseId: string
      }> = []
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
          if (
            (link.forward.onDelete === "restrict" &&
              allIds.includes(pair.forwardId) &&
              !allIds.includes(pair.reverseId)) ||
            (link.reverse.onDelete === "restrict" &&
              allIds.includes(pair.reverseId) &&
              !allIds.includes(pair.forwardId))
          )
            return yield* Effect.fail(
              new CascadeDeleteRestricted({
                recordId: allIds.includes(pair.forwardId)
                  ? pair.forwardId
                  : pair.reverseId,
              })
            )
          removed.push({ linkId: link.id, ...pair })
        }
      }
      yield* preserveRecordSnapshots(visited)
      const events = makeEventWriter(database, context)
      const touched = new Set<string>()
      for (const pair of removed) {
        touched.add(pair.forwardId)
        touched.add(pair.reverseId)
        yield* events.record({
          type: `${pair.linkId}.unlinked`,
          subjects: yield* events.subjects([pair.forwardId, pair.reverseId]),
          data: { link: pair.linkId },
          controllerKeys: yield* events.linkTargets(pair),
        })
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
