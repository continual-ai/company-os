import { Effect } from "effect"

import {
  controllerWatchPaths,
  type ControllerWatchStep,
} from "#/runtime/model/definition/controller-watch.ts"
import { modelTypeAccepts } from "#/runtime/model/definition/model.ts"
import type { EventSubject } from "#/runtime/server/events/event-buffer.ts"
import type { ModelContext } from "#/runtime/server/model-context.ts"
import type { PostgresDatabase } from "#/runtime/server/storage/transactions.ts"

export type ControllerKeys = Readonly<Record<string, ReadonlyArray<string>>>

export function mergeControllerKeys(
  ...groups: ReadonlyArray<ControllerKeys>
): ControllerKeys {
  const result = new Map<string, Set<string>>()
  for (const group of groups)
    for (const [controller, keys] of Object.entries(group)) {
      const merged = result.get(controller) ?? new Set<string>()
      for (const key of keys) merged.add(key)
      result.set(controller, merged)
    }
  return Object.fromEntries(
    [...result].map(([controller, keys]) => [controller, [...keys]])
  )
}

/** Capture dependencies inside the write transaction, before removing any edges. */
export function makeControllerRouting(
  database: PostgresDatabase,
  context: typeof ModelContext.Service
) {
  const { model, storage } = context
  const { sql } = database
  const controllers = Object.values(model.modules).flatMap((module) =>
    module.controllers.map((definition) => {
      const paths = controllerWatchPaths(
        {
          objects: Object.values(model.objects),
          links: Object.values(model.links),
        },
        definition
      )
      const prefixes = new Map<string, ReadonlyArray<ControllerWatchStep>>()
      for (const path of paths)
        for (let length = 1; length <= path.length; length++) {
          const prefix = path.slice(0, length)
          prefixes.set(
            prefix
              .map(({ link, direction }) => `${link.id}:${direction}`)
              .join("/"),
            prefix
          )
        }
      return { definition, prefixes: [...prefixes.values()] }
    })
  )

  // Share identical path lookups between controllers only within one routing call.
  // A later call must observe intervening relationship writes.
  const roots = (
    cache: Map<string, ReadonlyArray<string>>,
    objectType: string,
    path: ReadonlyArray<ControllerWatchStep>,
    ids: ReadonlyArray<string>
  ) => {
    const key = JSON.stringify([
      objectType,
      path.map(({ link, direction }) => [link.id, direction]),
      ids,
    ])
    const cached = cache.get(key)
    if (cached !== undefined) return Effect.succeed(cached)
    let query = sql`select unnest(${ids}::text[]) as id`
    for (let index = path.length - 1; index >= 0; index--) {
      const step = path[index]!
      const table = storage.linkTables[step.link.id]!
      const source =
        step.direction === "forward"
          ? table.columns.forwardId
          : table.columns.reverseId
      const target =
        step.direction === "forward"
          ? table.columns.reverseId
          : table.columns.forwardId
      query = sql`select ${source} as id from ${table} where ${target} in (${query})`
    }
    return sql<{
      id: string
    }>`select id from ${storage.core.objects} where object_type = ${objectType} and id in (${query})`.pipe(
      Effect.map((rows) => {
        const result = rows.map(({ id }) => id)
        cache.set(key, result)
        return result
      })
    )
  }

  const record = Effect.fn("@company/Controllers.recordKeys")(
    function* (event: {
      readonly type: string
      readonly subjects: ReadonlyArray<EventSubject>
      readonly writtenFields?: ReadonlyArray<string>
    }) {
      const result: Record<string, string[]> = {}
      const cache = new Map<string, ReadonlyArray<string>>()
      for (const { definition, prefixes } of controllers) {
        const keys = new Set<string>()
        const ignored =
          event.type === `${definition.objectType}.updated` &&
          event.writtenFields !== undefined &&
          event.writtenFields.length > 0 &&
          event.writtenFields.every((field) =>
            definition.ignoreUpdates?.includes(field)
          )
        if (
          !ignored &&
          ["created", "updated", "deleted"].some(
            (kind) => event.type === `${definition.objectType}.${kind}`
          )
        )
          for (const subject of event.subjects)
            if (subject.objectType === definition.objectType)
              keys.add(subject.id)
        for (const prefix of prefixes) {
          const last = prefix.at(-1)!
          const targetType = last.link[last.direction].to.typeId
          const ids = event.subjects
            .filter(
              (subject) =>
                modelTypeAccepts(model, subject.objectType, targetType) &&
                ["created", "updated", "deleted"].some(
                  (kind) => event.type === `${subject.objectType}.${kind}`
                )
            )
            .map(({ id }) => id)
          if (ids.length > 0)
            for (const id of yield* roots(
              cache,
              definition.objectType,
              prefix,
              ids
            ))
              keys.add(id)
        }
        if (keys.size > 0)
          result[definition.id] =
            definition.scope === "object" ? ["object"] : [...keys]
      }
      return result
    }
  )

  const link = Effect.fn("@company/Controllers.linkKeys")(function* (change: {
    readonly linkId: string
    readonly forwardId: string
    readonly reverseId: string
  }) {
    const result: Record<string, string[]> = {}
    const cache = new Map<string, ReadonlyArray<string>>()
    for (const { definition, prefixes } of controllers) {
      const keys = new Set<string>()
      for (const prefix of prefixes) {
        const last = prefix.at(-1)!
        if (last.link.id !== change.linkId) continue
        const sourceId =
          last.direction === "forward" ? change.forwardId : change.reverseId
        for (const id of yield* roots(
          cache,
          definition.objectType,
          prefix.slice(0, -1),
          [sourceId]
        ))
          keys.add(id)
      }
      if (keys.size > 0)
        result[definition.id] =
          definition.scope === "object" ? ["object"] : [...keys]
    }
    return result
  })
  return { record, link }
}
