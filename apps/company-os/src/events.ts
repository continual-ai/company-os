import { toEffectSchema, toEffectObjectSchema } from "@company/runtime/effect"
import { Model } from "company-os/model"
import { Schema, Tuple } from "effect"

import { LeadConverted } from "@/modules/sales/lead/model"

const subject = Schema.Struct({ id: Schema.String, objectType: Schema.String })
const envelope = {
  id: Schema.String,
  transactionId: Schema.String,
  actorId: Schema.String,
  occurredAt: Schema.String,
  recordedAt: Schema.String,
}
const objectEventTypes = Object.values(Model.objects).flatMap((object) =>
  (["created", "updated", "deleted"] as const).map(
    (kind) => `${object.id}.${kind}` as const
  )
)
const linkEventTypes = Object.values(Model.links).flatMap((link) =>
  (["linked", "unlinked"] as const).map((kind) => `${link.id}.${kind}` as const)
)

// Version 1 facts remain readable after upgrading an existing journal.
const snapshotFacts = Object.values(Model.objects).map((object) =>
  Schema.Struct({
    type: Schema.Literals([`${object.id}.created`, `${object.id}.updated`]),
    version: Schema.Literal(2),
    data: toEffectObjectSchema(object),
  })
)
const deletionTypes = Object.values(Model.objects).map(
  (object) => `${object.id}.deleted` as const
)

/** Validate facts before persistence; database-owned envelope fields are added only on replay. */
export const eventFactSchema = Schema.Union([
  ...snapshotFacts,
  Schema.Struct({
    type: Schema.Literals(deletionTypes),
    version: Schema.Literal(2),
    data: Schema.Struct({ id: Schema.String, etag: Schema.String }),
  }),
  Schema.Struct({
    type: Schema.Literals(objectEventTypes),
    version: Schema.Literal(1),
    data: Schema.Struct({}),
  }),
  Schema.Struct({
    type: Schema.Literals(linkEventTypes),
    version: Schema.Literal(1),
    data: Schema.Struct({ link: Schema.String }),
  }),
  Schema.Struct({
    type: Schema.Literal(LeadConverted.type),
    version: Schema.Literal(LeadConverted.version),
    data: toEffectSchema(LeadConverted.data),
  }),
]).mapMembers(
  Tuple.map(
    Schema.fieldsAssign({
      subjects: Schema.Array(subject).check(Schema.isMinLength(1)),
    })
  )
)

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
