import { eventPageSchema } from "@company/runtime/client/events"
import { createEventFactSchema } from "@company/runtime/client/events"
import { Schema } from "effect"
import { expect, it } from "vitest"

import { Model } from "#/examples/model.ts"
const eventFactSchema = createEventFactSchema(Model)

it("validates new facts strictly and replays them inside a stable envelope", () => {
  const fact = {
    type: "lead.converted",
    version: 1,
    subjects: [{ id: "ld_ada", objectType: "lead" }],
    data: { company: "co_engine", contact: "ct_ada" },
  }
  const decode = Schema.decodeUnknownSync(eventFactSchema)
  const decoded = decode(fact)
  if (decoded.type !== "lead.converted") throw new Error("Wrong event type")
  expect(decoded.data).toEqual(fact.data)

  for (const invalid of [
    { ...fact, type: "lead.unknown" },
    { ...fact, type: "contact.updated", data: {} },
    { ...fact, version: 2 },
    { ...fact, subjects: [] },
    { ...fact, data: { company: "co_engine" } },
  ])
    expect(() => decode(invalid)).toThrow()

  const envelope = {
    id: "ev_conversion",
    transactionId: "transaction",
    actorId: "usr_actor",
    occurredAt: "2026-09-05T00:00:00.000Z",
    recordedAt: "2026-09-05T00:00:01.000Z",
  }
  const page = {
    items: [{ ...fact, ...envelope }],
    nextCursor: "opaque",
    hasMore: false,
    reset: false,
  }
  expect(Schema.decodeUnknownSync(eventPageSchema)(page)).toEqual(page)
  expect(() =>
    Schema.decodeUnknownSync(eventPageSchema)({
      ...page,
      items: [fact],
    })
  ).toThrow()
})

it("preserves historical payloads after model or event definitions change", () => {
  const historical = {
    id: "event_old",
    transactionId: "transaction_old",
    actorId: "user_old",
    occurredAt: "2026-01-01T00:00:00.000Z",
    recordedAt: "2026-01-01T00:00:00.000Z",
    type: "contact.updated",
    version: 1,
    subjects: [{ id: "contact_old", objectType: "contact" }],
    data: { id: "contact_old", etag: "2", retiredField: "Original value" },
  }
  const page = {
    items: [historical, { ...historical, type: "retired.fact", version: 7 }],
    nextCursor: "opaque",
    hasMore: false,
    reset: false,
  }
  expect(Schema.decodeUnknownSync(eventPageSchema)(page)).toEqual(page)
  expect(() => Schema.decodeUnknownSync(eventFactSchema)(historical)).toThrow()
})
