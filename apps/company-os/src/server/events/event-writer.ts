import { randomUUID } from "node:crypto"

import { modelTypeAccepts } from "@company/runtime"
import type {
  AnySchema,
  InferSchema,
  ObjectType,
  RecordId,
} from "@company/runtime"
import { toEffectSchema } from "@company/runtime/effect"
import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { Model } from "company-os/model"
import { inArray } from "drizzle-orm"
import { DateTime, Effect, Option, Schema } from "effect"

import { eventFactSchema } from "@/events"
import type { Database } from "@/server/database/database"
import { objects } from "@/server/database/schema"

import { stageEvent, type EventSubject } from "./event-buffer"
import { eventReferences } from "./event-references"

/** Shared by standard writers and EventJournal; uses the caller's existing SQL transaction. */
export function makeEventWriter(database: typeof Database.Service) {
  const subjects = (ids: ReadonlyArray<string>) =>
    Effect.gen(function* () {
      const rows =
        ids.length === 0
          ? []
          : yield* database
              .select({
                id: objects.id,
                objectType: objects.objectType,
                ancestorIds: objects.ancestorIds,
              })
              .from(objects)
              .where(inArray(objects.id, [...new Set(ids)]))
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
    readonly data?: unknown
    readonly actorId?: string
  }) {
    const invocation = yield* Effect.serviceOption(CurrentInvocation)
    const actorId = Option.isSome(invocation)
      ? invocation.value.actorId
      : input.actorId
    if (actorId === undefined)
      return yield* Effect.die(
        "Recording an event requires an invocation or an explicit internal actor."
      )
    const occurredAt = DateTime.formatIso(yield* DateTime.now)
    // Validate against the installed public contract before a bad event could poison replay.
    const decoded = yield* Schema.decodeUnknownEffect(eventFactSchema)({
      type: input.type,
      subjects: input.subjects,
      version: input.version ?? 1,
      data: input.data ?? {},
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
