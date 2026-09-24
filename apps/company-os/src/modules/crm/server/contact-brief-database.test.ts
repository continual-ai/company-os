import { Effect } from "effect"
import { expect } from "vitest"

import { ContactBrief } from "#/modules/crm/model/contact-brief.ts"
import { Contact } from "#/modules/crm/model/contact.ts"
import { CrmModule } from "#/modules/crm/model/index.ts"
import { CrmServer } from "#/modules/crm/server/index.ts"
import { defineModel, Timestamp } from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { Note } from "#/runtime/platform/model/note.ts"
import { Database, operationsFor } from "#/runtime/server/index.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const fixture = testFoundation(
  defineModel({ name: "Brief test", modules: [PlatformModule, CrmModule] }),
  { servers: [CrmServer] }
)

fixture.test("deduplicates requests and atomically completes once", () =>
  Effect.gen(function* () {
    const database = yield* Database
    const api = yield* operationsFor(fixture.model)
    const contact = yield* database
      .repository(Contact)
      .create({ name: "Synthetic contact" })
    const request = { id: contact.id, requestKey: "test" }
    const first = yield* database.transaction(() =>
      api.contact.requestBrief(request)
    )
    expect(
      yield* database.transaction(() => api.contact.requestBrief(request))
    ).toEqual(first)
    const begun = yield* database.transaction(() =>
      api.contactBrief.begin({ id: first.briefId, threadId: "th_test" })
    )
    const completion = {
      id: first.briefId,
      leaseToken: begun.leaseToken,
      inputRevision: begun.inputRevision,
      summary: "Useful brief",
    }
    expect(
      yield* database.transaction(() => api.contactBrief.complete(completion))
    ).toEqual({ status: "completed" })
    expect(
      yield* database.transaction(() => api.contactBrief.complete(completion))
    ).toEqual({ status: "completed" })
    expect(
      (yield* database.repository(Contact).get({ id: contact.id })).summary
    ).toBe("Useful brief")
    expect(
      (yield* database.repository(ContactBrief).get({ id: first.briefId }))
        .threadId
    ).toBe("th_test")
  })
)

fixture.test(
  "rejects changed note context and preserves the existing summary",
  () =>
    Effect.gen(function* () {
      const database = yield* Database
      const api = yield* operationsFor(fixture.model)
      const contact = yield* database
        .repository(Contact)
        .create({ name: "Synthetic contact", summary: "Existing" })
      const note = yield* database
        .repository(Note)
        .create({ content: "First", links: { subjects: [contact.id] } })
      const { briefId } = yield* database.transaction(() =>
        api.contact.requestBrief({ id: contact.id, requestKey: "stale" })
      )
      const begun = yield* database.transaction(() =>
        api.contactBrief.begin({ id: briefId, threadId: "th_test" })
      )
      yield* database
        .repository(Note)
        .update({ id: note.id, content: "Changed" })
      expect(
        yield* database.transaction(() =>
          api.contactBrief.complete({
            id: briefId,
            leaseToken: begun.leaseToken,
            inputRevision: begun.inputRevision,
            summary: "Stale",
          })
        )
      ).toEqual({ status: "stale" })
      expect(
        (yield* database.repository(Contact).get({ id: contact.id })).summary
      ).toBe("Existing")
    })
)

fixture.test("recovers an expired lease and rejects the previous worker", () =>
  Effect.gen(function* () {
    const database = yield* Database
    const api = yield* operationsFor(fixture.model)
    const contact = yield* database
      .repository(Contact)
      .create({ name: "Synthetic contact" })
    const { briefId } = yield* database.transaction(() =>
      api.contact.requestBrief({ id: contact.id, requestKey: "lease" })
    )
    const first = yield* database.transaction(() =>
      api.contactBrief.begin({ id: briefId, threadId: "th_old" })
    )
    expect(
      yield* database
        .transaction(() =>
          api.contactBrief.begin({ id: briefId, threadId: "th_overlap" })
        )
        .pipe(Effect.isFailure)
    ).toBe(true)
    yield* database.repository(ContactBrief).update({
      id: briefId,
      leaseExpiresAt: Timestamp("1970-01-01T00:00:00.000Z"),
    })
    const second = yield* database.transaction(() =>
      api.contactBrief.begin({ id: briefId, threadId: "th_new" })
    )
    expect(second.leaseToken).not.toBe(first.leaseToken)
    expect(
      yield* database
        .transaction(() =>
          api.contactBrief.complete({
            id: briefId,
            leaseToken: first.leaseToken,
            inputRevision: first.inputRevision,
            summary: "Old worker",
          })
        )
        .pipe(Effect.isFailure)
    ).toBe(true)
    yield* database.transaction(() =>
      api.contactBrief.fail({
        id: briefId,
        leaseToken: second.leaseToken,
        error: "Source unavailable",
      })
    )
    expect(
      (yield* database.repository(ContactBrief).get({ id: briefId })).status
    ).toBe("failed")
  })
)

fixture.test("concurrent retries create only one request", () =>
  Effect.gen(function* () {
    const database = yield* Database
    const api = yield* operationsFor(fixture.model)
    const contact = yield* database
      .repository(Contact)
      .create({ name: "Synthetic contact" })
    const input = { id: contact.id, requestKey: "concurrent" }
    const [first, second] = yield* Effect.all(
      [api.contact.requestBrief(input), api.contact.requestBrief(input)],
      { concurrency: 2 }
    )
    expect(first).toEqual(second)
    expect((yield* database.repository(ContactBrief).list({})).totalSize).toBe(
      1
    )
  })
)
