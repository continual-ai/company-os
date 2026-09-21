import { Effect } from "effect"
import { expect } from "vitest"

import {
  defineLink,
  defineModel,
  defineModule,
  defineObject,
  schema,
} from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { Database } from "#/runtime/server/database.ts"
import { EventJournal } from "#/runtime/server/events/event-journal.ts"
import { RecordStore } from "#/runtime/server/storage/record-store.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const Node = defineObject({
  id: "snapshotNode",
  collection: "snapshotNodes",
  name: "Node",
  pluralName: "Nodes",
  properties: { name: schema.string() },
  display: { title: "name" },
})
const Children = defineLink({
  id: "snapshotChildren",
  from: { object: Node, key: "children", onDelete: "restrict" },
  to: { object: Node, key: "parent", max: 1 },
})
const Related = defineLink({
  id: "aSnapshotRelated",
  from: { object: Node, key: "related" },
  to: { object: Node, key: "source", max: 1 },
})
const Owned = defineLink({
  id: "bSnapshotOwned",
  from: { object: Node, key: "owned", onDelete: "cascade" },
  to: { object: Node, key: "owner", max: 1 },
})
const model = defineModel({
  name: "Snapshot recovery",
  modules: [
    PlatformModule,
    defineModule({
      id: "snapshots",
      name: "Snapshots",
      objects: [Node],
      links: [Related, Owned, Children],
    }),
  ],
})
const fixture = testFoundation(model)

fixture.test(
  "a recovered deletion does not freeze the final journal snapshot",
  () =>
    Effect.gen(function* () {
      const database = yield* Database
      const journal = yield* EventJournal
      const repository = database.repository(Node)
      const parent = yield* repository.create({ name: "Initial" })
      yield* repository.create({
        name: "Prevents deletion",
        links: { parent: parent.id },
      })
      const before = yield* journal.list({ cursor: "now" })
      const result = yield* database.transaction(() =>
        Effect.gen(function* () {
          yield* repository.update({ id: parent.id, name: "Before deletion" })
          const rejected = yield* repository.delete({ id: parent.id }).pipe(
            Effect.map(() => false),
            Effect.catchTag("CascadeDeleteRestricted", () =>
              Effect.succeed(true)
            )
          )
          expect(rejected).toBe(true)
          return yield* repository.update({
            id: parent.id,
            name: "After recovery",
          })
        })
      )
      const page = yield* journal.list({ cursor: before.nextCursor })
      const updates = page.items.filter(
        (event) => event.type === "snapshotNode.updated"
      )
      expect(updates).toHaveLength(2)
      expect(updates.map((event) => event.data)).toEqual([result, result])
    })
)

for (const restricted of ["root", "child"] as const)
  fixture.test(
    `a recovered ${restricted} restriction leaves edges, cascades, and journal unchanged`,
    () =>
      Effect.gen(function* () {
        const database = yield* Database
        const journal = yield* EventJournal
        const repository = database.repository(Node)
        const parent = yield* repository.create({ name: "Parent" })
        const related = yield* repository.create({
          name: "Related",
          links: { source: parent.id },
        })
        const owned = yield* repository.create({
          name: "Owned",
          links: { owner: parent.id },
        })
        yield* repository.create({
          name: "Blocker",
          links: { parent: restricted === "root" ? parent.id : owned.id },
        })
        const ids = [parent.id, related.id, owned.id]
        const beforeRecords = yield* repository.batchGet({ ids })
        const before = yield* journal.list({ cursor: "now" })
        yield* database.transaction(() =>
          repository.delete({ id: parent.id }).pipe(
            Effect.match({
              onSuccess: () => {
                throw new Error("Expected restriction")
              },
              onFailure: (error) =>
                expect(error._tag).toBe("CascadeDeleteRestricted"),
            })
          )
        )
        expect(yield* repository.batchGet({ ids })).toEqual(beforeRecords)
        expect(
          (yield* journal.list({ cursor: before.nextCursor })).items
        ).toEqual([])
      })
  )

for (const batch of [false, true])
  fixture.test(
    `a recovered stale ${batch ? "batch" : "single"} deletion leaves owned records and journal unchanged`,
    () =>
      Effect.gen(function* () {
        const database = yield* Database
        const journal = yield* EventJournal
        const store = (yield* RecordStore).get(Node)
        const repository = database.repository(Node)
        const parent = yield* repository.create({ name: "Parent" })
        const owned = yield* repository.create({
          name: "Owned",
          links: { owner: parent.id },
        })
        const unrelated = yield* repository.create({ name: "Other root" })
        const stale = yield* repository.get({ id: parent.id })
        yield* repository.update({ id: parent.id, name: "Changed" })
        const ids = [parent.id, owned.id, unrelated.id]
        const beforeRecords = yield* repository.batchGet({ ids })
        const before = yield* journal.list({ cursor: "now" })
        yield* database.transaction(() =>
          (batch
            ? store.batchDelete([unrelated, stale])
            : repository.delete({ id: stale.id, etag: stale.etag })
          ).pipe(
            Effect.match({
              onSuccess: () => {
                throw new Error("Expected conflict")
              },
              onFailure: (error) =>
                expect(error._tag).toBe("ObjectWriteConflict"),
            })
          )
        )
        expect(yield* repository.batchGet({ ids })).toEqual(beforeRecords)
        expect(
          (yield* journal.list({ cursor: before.nextCursor })).items
        ).toEqual([])
      })
  )
