import { Effect } from "effect"
import { expect } from "vitest"

import { Note, NoteSubject, NotesModule } from "#/modules/notes/model/index.ts"
import { noteSeed } from "#/modules/notes/seeds/index.ts"
import { AccessModule } from "#/runtime/access/model/index.ts"
import { AssetsModule } from "#/runtime/assets/model/index.ts"
import {
  defineModel,
  defineModule,
  defineObject,
  schema,
} from "#/runtime/model/index.ts"
import { Database, Records } from "#/runtime/server/index.ts"
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
      AccessModule,
      AssetsModule,
      NotesModule,
      defineModule({ id: "topics", name: "Topics", objects: [Topic] }),
    ],
  })
)

fixture.test(
  "migrates and persists a Notes-only model without the demo domains",
  () =>
    Effect.gen(function* () {
      const records = yield* Records
      const { sql } = yield* Database
      expect(
        yield* sql`select to_regclass('companies') as companies, to_regclass(${tableName(fixture.storage.linkTables.noteSubjects)}) as subjects`
      ).toEqual([{ companies: null, subjects: expect.any(String) }])

      const notes = records.writer(Note)
      const first = yield* notes.create(noteSeed(0, "Notebook"))
      expect(first.parent).toBe("platform_system")
      const updated = yield* notes.update({
        id: first.id,
        etag: first.etag,
        content: "**Decision:** ship the notebook.",
      })
      expect((yield* records.get(Note).get(first.id)).content).toBe(
        updated.content
      )
      yield* notes.delete({ id: first.id, etag: updated.etag })
      expect((yield* records.get(Note).list({ pageSize: 10 })).totalSize).toBe(
        0
      )
    })
)
