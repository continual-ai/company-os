import { Effect } from "effect"
import { expect } from "vitest"

import {
  defineController,
  defineLink,
  defineModel,
  defineModule,
  defineObject,
  modelObjectLinkTraversals,
  schema,
} from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { Database } from "#/runtime/server/database.ts"
import { EventJournal } from "#/runtime/server/events/event-journal.ts"
import { Links } from "#/runtime/server/storage/link-store.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const Node = defineObject({
  id: "treeNode",
  collection: "treeNodes",
  name: "Node",
  pluralName: "Nodes",
  properties: { name: schema.string() },
  display: { title: "name" },
})
const Children = defineLink({
  id: "nodeChildren",
  from: { object: Node, key: "children", onDelete: "cascade" },
  to: { object: Node, key: "parent", max: 1 },
})
const Maintainer = defineController({
  id: "tree",
  record: Node,
  watch: ["children.children"],
})
const Model = defineModel({
  name: "Tree routing",
  modules: [
    PlatformModule,
    defineModule({
      id: "trees",
      name: "Trees",
      objects: [Node],
      links: [Children],
      controllers: [Maintainer],
    }),
  ],
})
const fixture = testFoundation(Model)
const children = modelObjectLinkTraversals(Model, Node).find(
  ({ traversal }) => traversal.key === "children"
)!

fixture.test(
  "routes same-type link endpoints by direction and ignores no-op links",
  () =>
    Effect.gen(function* () {
      const database = yield* Database
      const journal = yield* EventJournal
      const links = yield* Links
      const nodes = database.repository(Node)
      const root = yield* nodes.create({ name: "Root" })
      const child = yield* nodes.create({
        name: "Child",
        links: { parent: root.id },
      })
      const leaf = yield* nodes.create({
        name: "Leaf",
        links: { parent: child.id },
      })
      const { nextCursor: cursor } = yield* journal.list({ cursor: "now" })
      yield* links.unlink(children, { id: child.id, target: leaf.id })
      const page = yield* journal.list({ cursor })
      const keys = [
        ...new Set(
          page.items.flatMap((event) => event.controllerKeys.tree ?? [])
        ),
      ].sort()
      expect(keys).toEqual([root.id, child.id].sort())
      // Same object type at each end does not make the removed leaf a dependent parent.
      expect(keys).not.toContain(leaf.id)
      yield* links.unlink(children, { id: child.id, target: leaf.id })
      expect((yield* journal.list({ cursor: page.nextCursor })).items).toEqual(
        []
      )
    })
)

fixture.test(
  "routes both former and new ancestors when replacing a reverse relationship",
  () =>
    Effect.gen(function* () {
      const database = yield* Database
      const journal = yield* EventJournal
      const nodes = database.repository(Node)
      const former = yield* nodes.create({ name: "Former root" })
      const current = yield* nodes.create({ name: "New root" })
      const branch = yield* nodes.create({
        name: "Branch",
        links: { parent: former.id },
      })
      const { nextCursor: cursor } = yield* journal.list({ cursor: "now" })
      yield* nodes.update({ id: branch.id, links: { parent: current.id } })
      const page = yield* journal.list({ cursor })
      expect(
        page.items.find((event) => event.type === "nodeChildren.unlinked")
          ?.controllerKeys.tree
      ).toEqual([former.id])
      expect(
        page.items.find((event) => event.type === "nodeChildren.linked")
          ?.controllerKeys.tree
      ).toEqual([current.id])
    })
)

fixture.test(
  "captures dependencies before cascading deletion removes a complete branch",
  () =>
    Effect.gen(function* () {
      const database = yield* Database
      const journal = yield* EventJournal
      const nodes = database.repository(Node)
      const root = yield* nodes.create({ name: "Root" })
      const child = yield* nodes.create({
        name: "Child",
        links: { parent: root.id },
      })
      const leaf = yield* nodes.create({
        name: "Leaf",
        links: { parent: child.id },
      })
      const { nextCursor: cursor } = yield* journal.list({ cursor: "now" })
      yield* nodes.delete({ id: child.id })
      const page = yield* journal.list({ cursor })
      const keys = [
        ...new Set(
          page.items.flatMap((event) => event.controllerKeys.tree ?? [])
        ),
      ].sort()
      expect(keys).toEqual([root.id, child.id, leaf.id].sort())
      expect((yield* nodes.list({})).items.map(({ id }) => id)).toEqual([
        root.id,
      ])
    })
)
