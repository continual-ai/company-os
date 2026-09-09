import { Effect } from "effect"
import { expect, it } from "vitest"

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
import { systemInvocation } from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { makePostgresSchema } from "#/runtime/server/storage/index.ts"
import { tableName } from "#/runtime/server/storage/table.ts"
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

it("migrates and persists a Notes-only model without the demo domains", async () => {
  const model = defineModel({
    name: "Notebook",
    modules: [
      AccessModule,
      AssetsModule,
      NotesModule,
      defineModule({ id: "topics", name: "Topics", objects: [Topic] }),
    ],
  })
  const storage = makePostgresSchema(model)
  const fixture = await testFoundation(model)
  try {
    await Effect.runPromise(
      Effect.gen(function* () {
        const records = yield* Records
        const { sql } = yield* Database
        expect(
          yield* sql`select to_regclass('companies') as companies, to_regclass(${tableName(storage.linkTables.noteSubjects)}) as subjects`
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
        expect(
          (yield* records.get(Note).list({ pageSize: 10 })).totalSize
        ).toBe(0)
      }).pipe(
        Effect.provideService(CurrentInvocation, systemInvocation),
        Effect.provide(fixture.layer)
      )
    )
  } finally {
    await fixture.dispose()
  }
}, 15000)
