import { expect, it } from "vitest"

import { defineModel } from "#/runtime/model/definition/model.ts"
import { defineModule } from "#/runtime/model/definition/module.ts"
import { defineObject } from "#/runtime/model/definition/object.ts"
import { schema } from "#/runtime/model/definition/schema.ts"

it.each([
  { id: "records", collection: "things" },
  { id: "events", collection: "things" },
  { id: "changes", collection: "things" },
  { id: "thing", collection: "records" },
  { id: "thing", collection: "events" },
  { id: "thing", collection: "changes" },
])(
  "rejects reserved namespaces before compiling any adapter: $id / $collection",
  (identity) => {
    const object = defineObject({
      ...identity,
      name: "Thing",
      pluralName: "Things",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    expect(() =>
      defineModel({
        name: "Reserved names",
        modules: [
          defineModule({ id: "example", name: "Example", objects: [object] }),
        ],
      })
    ).toThrow("reserved operation namespace")
  }
)
