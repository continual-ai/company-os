import { Effect } from "effect"
import { expect } from "vitest"

import {
  defineModel,
  defineModule,
  defineObject,
  schema,
} from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { NoteSubject } from "#/runtime/platform/model/note-subject.ts"
import { Note } from "#/runtime/platform/model/note.ts"
import { noteSeed } from "#/runtime/platform/seeds/note.ts"
import { Database } from "#/runtime/server/index.ts"
import { tableName } from "#/runtime/server/storage/index.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const Topic = defineObject({
  id: "topic",
  collection: "topics",
  name: "Topic",
  pluralName: "Topics",
  implements: [{ interface: NoteSubject }],
  properties: { name: schema.string() },
  display: { title: "name" },
})

const Decision = defineObject({
  id: "decision",
  collection: "decisions",
  name: "Decision",
  pluralName: "Decisions",
  implements: [{ interface: NoteSubject }],
  properties: { name: schema.string() },
  display: { title: "name" },
})

const fixture = testFoundation(
  defineModel({
    name: "Notebook",
    modules: [
      PlatformModule,
      defineModule({
        id: "topics",
        name: "Topics",
        objects: [Topic, Decision],
      }),
    ],
  })
)

fixture.test(
  "shares a note across record types without owning its subjects",
  () =>
    Effect.gen(function* () {
      const records = yield* Database
      const notes = records.repository(Note)
      const topics = records.repository(Topic)
      const decisions = records.repository(Decision)
      const topic = yield* topics.create({ name: "Release" })
      const decision = yield* decisions.create({ name: "Ship on Friday" })
      const note = yield* notes.create({
        content: "Release context shared with the decision.",
        links: { subjects: [topic.id, decision.id] },
      })
      expect((yield* notes.get({ id: note.id })).links.subjects).toMatchObject({
        totalSize: 2,
        totalSizeExact: true,
      })
      expect((yield* topics.get({ id: topic.id })).links.notes).toMatchObject({
        totalSize: 1,
        totalSizeExact: true,
      })
      expect(
        (yield* decisions.get({ id: decision.id })).links.notes
      ).toMatchObject({
        totalSize: 1,
        totalSizeExact: true,
      })

      yield* notes.update({
        id: note.id,
        links: { subjects: { remove: [topic.id] } },
      })
      expect((yield* topics.get({ id: topic.id })).links.notes).toMatchObject({
        totalSize: 0,
        totalSizeExact: true,
      })
      expect((yield* notes.get({ id: note.id })).links.subjects).toMatchObject({
        totalSize: 1,
        totalSizeExact: true,
      })
      yield* decisions.delete({ id: decision.id })
      expect((yield* notes.get({ id: note.id })).links.subjects).toMatchObject({
        totalSize: 0,
        totalSizeExact: true,
      })
      yield* notes.update({ id: note.id, links: { subjects: [topic.id] } })
      yield* notes.delete({ id: note.id })
      expect((yield* topics.get({ id: topic.id })).links.notes).toMatchObject({
        totalSize: 0,
        totalSizeExact: true,
      })
    })
)

fixture.test("persists platform notes without the demo domains", () =>
  Effect.gen(function* () {
    const records = yield* Database
    const { sql } = yield* Database
    expect(
      yield* sql`select to_regclass('accounts') as accounts, to_regclass(${tableName(fixture.storage.linkTables.noteSubjects)}) as subjects`
    ).toEqual([{ accounts: null, subjects: expect.any(String) }])

    const notes = records.repository(Note)
    const first = yield* notes.create(noteSeed(0, "Notebook"))
    const updated = yield* notes.update({
      id: first.id,
      etag: first.etag,
      content: "**Decision:** ship the notebook.",
    })
    expect(
      (yield* records.repository(Note).get({ id: first.id })).content
    ).toBe(updated.content)
    yield* notes.delete({ id: first.id, etag: updated.etag })
    expect(
      (yield* records.repository(Note).list({ pageSize: 10 })).totalSize
    ).toBe(0)
  })
)
