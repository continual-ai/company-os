import {
  defineInterface,
  defineLink,
  defineModel,
  defineModule,
  defineObject,
  defineRoot,
  schema,
} from "@company/runtime"
import { createModelClient } from "@company/runtime/effect/http-client"
import { Effect } from "effect"
import { expect, expectTypeOf, it } from "vitest"

import { createModelQueries } from "#/model-query-client.ts"

it("preserves required relationship capabilities when projecting the client", () => {
  const Actor = defineInterface({
    id: "actor",
    name: "Actor",
    pluralName: "Actors",
  })
  const Root = defineRoot({
    id: "root",
    name: "Root",
    implements: [{ interface: Actor }],
  })
  const Thing = defineObject({
    id: "thing",
    collection: "things",
    name: "Thing",
    pluralName: "Things",
    parent: Root,
    properties: { name: schema.string() },
    display: { title: "name" },
  })
  const hierarchy = defineLink({
    id: "hierarchy",
    name: "Hierarchy",
    writeFrom: "parentThing",
    forward: {
      from: Thing,
      to: Thing,
      key: "parentThing",
      label: "Parent thing",
      cardinality: "one",
    },
    reverse: {
      from: Thing,
      to: Thing,
      key: "children",
      label: "Children",
      cardinality: "many",
    },
  })
  const model = defineModel({
    name: "Required relationships",
    root: Root,
    actor: Actor,
    modules: [
      defineModule({
        id: "test",
        name: "Test",
        interfaces: [Actor],
        objects: [Thing],
        links: [hierarchy],
      }),
    ],
  })
  const client = createModelClient(model, {
    thing: {
      listThings: () =>
        Effect.succeed({ items: [], totalSize: 0, nextPageToken: null }),
    },
  })
  const data = createModelQueries(model, client)
  expect(Object.keys(data.thing.parentThing)).toEqual(["list", "link"])
  expect(Object.keys(data.thing.children)).toEqual(["list"])
  expectTypeOf<keyof typeof data.thing.parentThing>().toEqualTypeOf<
    "list" | "link"
  >()
})
