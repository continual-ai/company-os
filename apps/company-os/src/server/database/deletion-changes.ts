import { modelTypeAccepts, type ObjectType } from "@company/runtime"
import { Model } from "company-os/model"
import { inArray, sql } from "drizzle-orm"
import { Effect } from "effect"

import { makeEventWriter } from "@/server/events/event-writer"

import type { Database } from "./database"
import { Storage } from "./schema"

const cascades = (cardinality: string) => cardinality !== "one"

/** Capture Link endpoints before cascades erase them. Row locks exclude concurrent FK inserts. */
export function deletionChanges(
  database: typeof Database.Service,
  object: ObjectType
) {
  const traversals = Object.values(Model.links).flatMap((link) => {
    const table = Storage.linkTables[link.id]
    return [
      ...(modelTypeAccepts(Model, object.id, link.forward.from.typeId) &&
      cascades(link.reverse.cardinality)
        ? [{ source: table.forwardId, table, linkId: link.id }]
        : []),
      ...(modelTypeAccepts(Model, object.id, link.reverse.from.typeId) &&
      cascades(link.forward.cardinality)
        ? [{ source: table.reverseId, table, linkId: link.id }]
        : []),
    ]
  })
  return (ids: ReadonlyArray<string>) =>
    Effect.gen(function* () {
      if (ids.length === 0 || traversals.length === 0) return
      const objects = Storage.core.objects
      yield* database
        .select({ id: objects.id })
        .from(objects)
        .where(inArray(objects.id, [...ids]))
        .orderBy(objects.id)
        .for("update")
      const events = makeEventWriter(database)
      const seen = new Set<string>()
      for (const { source, table, linkId } of traversals) {
        const rows = yield* database
          .select({
            forwardId: sql<string>`${table.forwardId}`,
            reverseId: sql<string>`${table.reverseId}`,
          })
          .from(table)
          .where(inArray(source, [...ids]))
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
