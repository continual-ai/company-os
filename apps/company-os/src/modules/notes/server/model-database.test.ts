import { Effect } from "effect"
import { expect } from "vitest"

import { Note, NoteSubject, NotesModule } from "#/modules/notes/model/index.ts"
import { noteSeed } from "#/modules/notes/seeds/index.ts"
import {
  defineModel,
  defineModule,
  defineObject,
  schema,
} from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
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

const fixture = testFoundation(
  defineModel({
    name: "Notebook",
    modules: [
      PlatformModule,
      NotesModule,
      defineModule({ id: "topics", name: "Topics", objects: [Topic] }),
    ],
  })
)

fixture.test(
  "migrates and persists a Notes-only model without the demo domains",
  () =>
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
