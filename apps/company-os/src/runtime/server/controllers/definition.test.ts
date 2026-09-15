import { Effect } from "effect"
import { expect, expectTypeOf, it } from "vitest"

import {
  defineController,
  defineObject,
  type RecordId,
  schema,
} from "#/runtime/model/index.ts"
import { defineControllerServer } from "#/runtime/server/controllers/definition.ts"

const Item = defineObject({
  id: "typedItem",
  collection: "typedItems",
  name: "Item",
  pluralName: "Items",
  properties: { title: schema.string() },
  display: { title: "title" },
})

it("infers target record IDs for reconciliation and event routing", () => {
  const definition = defineController({ id: "typed", object: Item })
  let observed: string | undefined
  const server = defineControllerServer(definition, {
    reconcile: (key) => {
      expectTypeOf(key).toEqualTypeOf<RecordId<"typedItem">>()
      return Effect.sync(() => {
        observed = key
      })
    },
    onEvent: (_event, { queue }) => {
      expectTypeOf(queue.add)
        .parameter(0)
        .toEqualTypeOf<RecordId<"typedItem">>()
      return Effect.void
    },
  })
  Effect.runSync(server.reconcile("typed_item_123"))
  expect(observed).toBe("typed_item_123")
})

it("collection reconciliation and event routing require no key", () => {
  const definition = defineController({ id: "collection", collection: Item })
  const server = defineControllerServer(definition, {
    reconcile: (...args) => {
      expectTypeOf(args).toEqualTypeOf<[]>()
      expect(args).toEqual([])
      return Effect.void
    },
    onEvent: (_event, { queue }) => {
      expectTypeOf(queue.add).parameters.toEqualTypeOf<[]>()
      return queue.add()
    },
  })
  Effect.runSync(server.reconcile("collection"))
})
