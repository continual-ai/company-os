import { Schema, Tuple } from "effect"

import {
  toEffectSchema,
  toEffectObjectSchema,
} from "#/runtime/contract/schema.ts"
import type { ModelCatalog } from "#/runtime/model/index.ts"

const subject = Schema.Struct({ id: Schema.String, objectType: Schema.String })
const envelope = {
  id: Schema.String,
  transactionId: Schema.String,
  actorId: Schema.String,
  occurredAt: Schema.String,
  recordedAt: Schema.String,
}
export function createEventFactSchema(Model: ModelCatalog) {
  const linkEventTypes = Object.values(Model.links).flatMap((link) =>
    (["linked", "unlinked"] as const).map(
      (kind) => `${link.id}.${kind}` as const
    )
  )

  const snapshotFacts = Object.values(Model.objects).map((object) =>
    Schema.Struct({
      type: Schema.Literals([`${object.id}.created`, `${object.id}.updated`]),
      version: Schema.Literal(1),
      data: toEffectObjectSchema(object),
    })
  )
  const deletionTypes = Object.values(Model.objects).map(
    (object) => `${object.id}.deleted` as const
  )

  /** Validate facts before persistence; database-owned envelope fields are added only on replay. */
  const eventFactSchema = Schema.Union([
    ...snapshotFacts,
    Schema.Struct({
      type: Schema.Literals(deletionTypes),
      version: Schema.Literal(1),
      data: Schema.Struct({ id: Schema.String, etag: Schema.String }),
    }),
    Schema.Struct({
      type: Schema.Literals(linkEventTypes),
      version: Schema.Literal(1),
      data: Schema.Struct({ link: Schema.String }),
    }),
    ...Object.values(Model.modules).flatMap((module) =>
      (module.events ?? []).map((event) =>
        Schema.Struct({
          type: Schema.Literal(event.type),
          version: Schema.Literal(event.version),
          data: toEffectSchema(event.data),
        })
      )
    ),
  ]).mapMembers(
    Tuple.map(
      Schema.fieldsAssign({
        subjects: Schema.Array(subject).check(Schema.isMinLength(1)),
      })
    )
  )

  return eventFactSchema
}
/** Replay is an immutable JSON document, independent of today's model schema.
 * Writers validate eventFactSchema; consumers decode versions they understand. */
const eventSchema = Schema.Struct({
  ...envelope,
  type: Schema.String,
  version: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
  subjects: Schema.Array(subject).check(Schema.isMinLength(1)),
  data: Schema.Json,
})

export const eventPageSchema = Schema.Struct({
  items: Schema.Array(eventSchema),
  nextCursor: Schema.String,
  hasMore: Schema.Boolean,
  reset: Schema.Boolean,
})
export type EventPage = typeof eventPageSchema.Type

/** Invalid, incompatible, or identity-mismatched cursors require a fresh snapshot and cursor. */
export class InvalidEventCursor extends Schema.TaggedError<InvalidEventCursor>()(
  "InvalidEventCursor",
  { message: Schema.String }
) {}
