import { expect, expectTypeOf, it } from "vitest"

import { createEffectClient } from "#/runtime/client/create-client.ts"
import { createModelQueries } from "#/runtime/client/model-query-client.ts"
import {
  defineLink,
  defineModel,
  defineModule,
  defineObject,
  schema,
} from "#/runtime/model/index.ts"

it("preserves required relationship capabilities when projecting the client", () => {
  const Thing = defineObject({
    id: "thing",
    collection: "things",
    name: "Thing",
    pluralName: "Things",
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
    modules: [
      defineModule({
        id: "test",
        name: "Test",
        interfaces: [],
        objects: [Thing],
        links: [hierarchy],
      }),
    ],
  })
  const client = createEffectClient(model, {
    baseUrl: "http://company.test",
    fetch: () => Promise.reject(new Error("No requests are made here.")),
  })
  const data = createModelQueries(model, client)
  expect(Object.keys(data.thing.parentThing)).toEqual(["list", "link"])
  expect(Object.keys(data.thing.children)).toEqual(["list"])
  expect(data.records.search({ query: "a" }).meta).toMatchObject({
    objectTypes: [],
    operation: "records.search",
  })
  expectTypeOf<keyof typeof data.thing.parentThing>().toEqualTypeOf<
    "list" | "link"
  >()
})
