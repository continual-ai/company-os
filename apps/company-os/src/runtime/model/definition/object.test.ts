import { describe, expect, it } from "vitest"

import { defineObject } from "#/runtime/model/definition/object.ts"
import { schema } from "#/runtime/model/definition/schema.ts"

describe("object properties", () => {
  it("uses schemas directly and normalizes object lifecycle behavior", () => {
    const Example = defineObject({
      id: "example",
      collection: "examples",
      name: "Example",
      pluralName: "Examples",
      properties: {
        title: schema.string(),
        count: schema.number({ default: 0 }),
        dueOn: schema.date({ nullable: true }),
        note: schema.string({ default: "", nullable: true }),
      },
      display: { title: "title" },
    })

    expect(Example.properties.title).toMatchObject({
      kind: "string",
      nullable: false,
      requiredOnCreate: true,
    })
    expect(Example.properties.count).toMatchObject({
      default: 0,
      requiredOnCreate: false,
    })
    expect(Example.properties.dueOn).toMatchObject({
      nullable: true,
      requiredOnCreate: false,
    })
    expect(Example.properties.note).toMatchObject({
      default: "",
      nullable: true,
      requiredOnCreate: false,
    })
  })

  it("normalizes output-only object properties", () => {
    const Example = defineObject({
      id: "exampleOutput",
      collection: "exampleOutputs",
      name: "Example output",
      pluralName: "Example outputs",
      properties: {
        result: schema.string({ nullable: true, outputOnly: true }),
        title: schema.string(),
      },
      display: { title: "title" },
    })

    expect(Example.properties.result).toMatchObject({
      nullable: true,
      outputOnly: true,
      requiredOnCreate: false,
    })
  })
})
