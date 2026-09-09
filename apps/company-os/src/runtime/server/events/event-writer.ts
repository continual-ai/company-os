import { randomUUID } from "node:crypto"

import { DateTime, Effect, Schema } from "effect"

import { toEffectSchema } from "#/runtime/contract/schema.ts"
import { modelTypeAccepts } from "#/runtime/model/index.ts"
import type {
  AnySchema,
  InferSchema,
  ObjectType,
  RecordId,
} from "#/runtime/model/index.ts"
import {
  stageEvent,
  type EventSubject,
} from "#/runtime/server/events/event-buffer.ts"
import { eventReferences } from "#/runtime/server/events/event-references.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import type { ModelContext } from "#/runtime/server/model-context.ts"
import type { Database } from "#/runtime/server/storage/database.ts"
import {
  projection,
  type SelectionRow,
  inValues,
} from "#/runtime/server/storage/index.ts"

/** Shared by standard writers and EventJournal; stages into the caller's open transaction and attributes facts to its invocation. */
export function makeEventWriter(
  database: typeof Database.Service,
  context: typeof ModelContext.Service
) {
  const { model: Model, eventFactSchema } = context
  const objects = context.storage.core.objects
  const sql = database.sql

  const subjects = (ids: ReadonlyArray<string>) =>
    Effect.gen(function* () {
      const rowsFields = {
        id: objects.columns.id,
        objectType: objects.columns.objectType,
        ancestorIds: objects.columns.ancestorIds,
      }
      const rows =
        ids.length === 0
          ? []
          : yield* sql<
              SelectionRow<typeof rowsFields>
            >`select ${projection(rowsFields)}
          from ${objects}
          where ${inValues(sql, objects.columns.id, [...new Set(ids)])}`
      const byId = new Map(rows.map((row) => [row.id, row]))
      return yield* Effect.forEach([...new Set(ids)], (id) => {
        const row = byId.get(id)
        return row === undefined
          ? Effect.die(`Event subject '${id}' does not exist.`)
          : Effect.succeed(row)
      })
    })
  const record = Effect.fn("@company/EventJournal.record")(function* (input: {
    readonly type: string
    readonly version?: number
    readonly subjects: ReadonlyArray<EventSubject>
    readonly data: unknown
  }) {
    const { actorId } = yield* CurrentInvocation
    const occurredAt = DateTime.formatIso(yield* DateTime.now)
    // Validate against the installed public contract before a bad event could poison replay.
    const decoded = yield* Schema.decodeUnknownEffect(eventFactSchema)({
      type: input.type,
      subjects: input.subjects,
      version: input.version ?? 1,
      data: input.data,
    })
    yield* stageEvent({
      id: `ev_${randomUUID()}`,
      type: decoded.type,
      version: decoded.version,
      subjects: structuredClone(input.subjects),
      actorId,
      data: structuredClone(decoded.data),
      occurredAt,
    })
    return undefined
  })
  return {
    subjects,
    record,
    /** Related subjects constrain visibility of every identifier or sensitive fact in the payload. */
    append: <TObject extends ObjectType, TData extends AnySchema>(
      definition: {
        readonly type: string
        readonly version: number
        readonly subject: TObject
        readonly data: TData
      },
      input: {
        readonly subject: RecordId<TObject["id"]>
        readonly related?: ReadonlyArray<string>
        readonly data: InferSchema<TData>
      }
    ) =>
      Effect.gen(function* () {
        const data = yield* Schema.decodeUnknownEffect(
          toEffectSchema(definition.data)
        )(input.data)
        const references = eventReferences(definition.data, data)
        const targets = yield* subjects([
          input.subject,
          ...references.map((reference) => reference.id),
          ...(input.related ?? []),
        ])
        if (
          references.some(
            (reference) =>
              !targets.some(
                (target) =>
                  target.id === reference.id &&
                  modelTypeAccepts(Model, target.objectType, reference.typeId)
              )
          )
        )
          return yield* Effect.die(
            "An event payload reference has the wrong object type."
          )
        if (targets[0]?.objectType !== definition.subject.id)
          return yield* Effect.die(
            "Event subject type does not match its definition."
          )
        return yield* record({
          type: definition.type,
          version: definition.version,
          subjects: targets,
          data,
        })
      }),
  }
}
