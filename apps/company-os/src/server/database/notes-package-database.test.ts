import { defineNotesModule } from "@company/notes/model"
import { NoteSubject } from "@company/notes/model"
import { noteSeed } from "@company/notes/seeds"
import {
  defineInterface,
  defineModel,
  defineModule,
  defineRoot,
  RecordId,
} from "@company/runtime/model"
import { Database } from "@company/runtime/server/database/database"
import { makeEncryptedPageTokenCodec } from "@company/runtime/server/page-tokens"
import {
  makeLinkRepository,
  makeObjectRepository,
  makePostgresSchema,
} from "@company/runtime/server/postgres"
import { Effect } from "effect"
import * as Migrator from "effect/unstable/sql/Migrator"
import * as SqlClient from "effect/unstable/sql/SqlClient"
import { expect, it } from "vitest"

import { TestDatabase } from "#/server/database/test-database.ts"

it("migrates and persists a Notes-only model without the demo domains", async () => {
  const Actor = defineInterface({
    id: "actor",
    name: "Actor",
    pluralName: "Actors",
  })
  const Root = defineRoot({
    id: "root",
    name: "Root",
    implements: [{ interface: Actor }, { interface: NoteSubject }],
  })
  const model = defineModel({
    name: "Notebook",
    root: Root,
    actor: Actor,
    modules: [
      defineModule({
        id: "identity",
        name: "Identity",
        interfaces: [Actor],
        objects: [],
        links: [],
      }),
      defineNotesModule(Root),
    ],
  })
  const storage = makePostgresSchema(model)
  const template = await TestDatabase.createTemplate("")
  try {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const db = yield* Database
          const sql = db.sql
          const migrate = () =>
            Migrator.make({})({
              table: "app_migrations",
              loader: Migrator.fromRecord({
                "1_initial": sql.unsafe(storage.ddl.join(";\n")),
              }),
            }).pipe(Effect.provideService(SqlClient.SqlClient, sql))
          yield* migrate()
          yield* migrate()
          expect(yield* sql`select migration_id from app_migrations`).toEqual([
            { migration_id: 1 },
          ])
          expect(
            yield* sql`select to_regclass('companies') as companies, to_regclass('deals') as deals`
          ).toEqual([{ companies: null, deals: null }])

          const root = RecordId("root")("root_notebook")
          yield* db.transaction(() =>
            Effect.gen(function* () {
              yield* sql`insert into objects (id, object_type, parent_id, ancestor_ids, created_by_id, updated_by_id)
          values (${root}, 'root', null, '{}', ${root}, ${root})`
              yield* sql`insert into roots (id) values (${root})`
              yield* sql`insert into interface_actor (id) values (${root})`
              yield* sql`insert into interface_note_subject (id) values (${root})`
            })
          )
          const tokens = makeEncryptedPageTokenCodec(new Uint8Array(32).fill(1))
          const notes = yield* makeObjectRepository(
            storage,
            model.objects.note,
            db,
            tokens
          )
          const links = makeLinkRepository(storage, db, tokens)
          const first = yield* notes.insert({
            ...noteSeed(0, "Notebook"),
            id: RecordId("note")("note_first"),
            parent: root,
            createdBy: root,
            updatedBy: root,
            aliases: [],
            metadata: {},
            systemManaged: false,
          })
          const pair = {
            linkId: "noteSubjects",
            direction: "forward",
            sourceId: first.id,
            targetId: root,
          } as const
          yield* links.link(pair)
          const related = yield* links.list({
            linkId: "noteSubjects",
            direction: "reverse",
            sourceId: root,
            pageSize: 10,
          })
          expect(related).toMatchObject({
            items: [{ id: first.id, objectType: "note" }],
            totalSize: 1,
          })
          const updated = yield* notes.update({
            id: first.id,
            etag: first.etag,
            content: "**Decision:** ship the notebook.",
            updatedBy: root,
          })
          expect((yield* notes.get(first.id)).content).toBe(updated.content)
          yield* notes.delete({ id: first.id, etag: updated.etag })
          expect(
            (yield* links.list({
              linkId: "noteSubjects",
              direction: "reverse",
              sourceId: root,
              pageSize: 10,
            })).totalSize
          ).toBe(0)
        }).pipe(Effect.provide(TestDatabase.layer(template)))
      )
    )
  } finally {
    await TestDatabase.drop(template)
  }
})
