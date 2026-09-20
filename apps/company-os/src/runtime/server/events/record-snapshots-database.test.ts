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
const model = defineModel({
  name: "Snapshot recovery",
  modules: [
    PlatformModule,
    defineModule({
      id: "snapshots",
      name: "Snapshots",
      objects: [Node],
      links: [Children],
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
