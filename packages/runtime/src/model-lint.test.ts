import { describe, expect, it } from "vitest"

import { defineInterface } from "#/definition/interface.ts"
import { defineModel } from "#/definition/model.ts"
import { defineModule } from "#/definition/module.ts"
import { defineObject } from "#/definition/object.ts"
import { defineRoot } from "#/definition/root.ts"
import { schema } from "#/definition/schema.ts"
import { describeModel } from "#/description.ts"
import { lintModelDescription } from "#/model-lint.ts"

const Actor = defineInterface({
  id: "actor",
  name: "Actor",
  pluralName: "Actors",
})
const Root = defineRoot({
  id: "root",
  implements: [{ interface: Actor }],
  name: "Root",
})
const Example = defineObject({
  id: "example",
  collection: "examples",
  display: { title: "eventDate" },
  name: "Example",
  parent: Root,
  pluralName: "Examples",
  properties: {
    archived: schema.boolean({ label: "Archived" }),
    attemptCount: schema.number({ integer: true, label: "Attempt count" }),
    eventAt: schema.timestamp({ label: "Event at" }),
    eventDate: schema.date({ label: "Event date" }),
  },
})
const Model = defineModel({
  actor: Actor,
  modules: [
    defineModule({
      id: "example",
      interfaces: [Actor],
      links: [],
      name: "Example",
      objects: [Example],
    }),
  ],
  name: "Example",
  root: Root,
})

describe("model policy", () => {
  it("requires explicit text fields for search and publishes their metadata", () => {
    const definition = {
      id: "searchable",
      collection: "searchables",
      name: "Searchable",
      pluralName: "Searchables",
      parent: Root,
      display: { title: "name" as const },
      properties: {
        name: schema.string(),
        date: schema.date(),
        count: schema.number(),
      },
    }
    expect(defineObject(definition).search).toBeUndefined()
    expect(
      defineObject({ ...definition, search: { fields: ["name"] } }).search
    ).toEqual({ fields: ["name"] })
    expect(() =>
      defineObject({ ...definition, search: { fields: [] } })
    ).toThrow("at least one field")
    expect(() =>
      defineObject({ ...definition, search: { fields: ["date"] } })
    ).toThrow("must be text")
    expect(() =>
      defineObject({ ...definition, search: { fields: ["count"] } })
    ).toThrow("must be text")
  })

  it("accepts the canonical model naming contract", () => {
    expect(lintModelDescription(describeModel(Model))).toEqual([])
  })

  it("reports every property violation with a stable semantic path", () => {
    const description = describeModel(Model)
    const example = description.objects[0]!
    const diagnostics = lintModelDescription({
      ...description,
      objects: [
        {
          ...example,
          properties: {
            eventTime: {
              ...schema.timestamp({ label: "event time" }),
              immutable: false,
              nullable: false,
              outputOnly: false,
              requiredOnCreate: true,
            },
            isArchived: {
              ...schema.boolean(),
              immutable: false,
              nullable: false,
              outputOnly: false,
              requiredOnCreate: true,
            },
            numAttempts: {
              ...schema.number(),
              immutable: false,
              nullable: false,
              outputOnly: false,
              requiredOnCreate: true,
            },
            regionCode: {
              ...schema.enumeration(["US"]),
              immutable: false,
              nullable: false,
              outputOnly: false,
              requiredOnCreate: true,
            },
          },
        },
      ],
    })

    expect(diagnostics.map(({ path, ruleId }) => ({ path, ruleId }))).toEqual([
      {
        path: ["objects", "example", "properties", "eventTime", "label"],
        ruleId: "model/label-sentence-case",
      },
      {
        path: ["objects", "example", "properties", "eventTime"],
        ruleId: "model/timestamp-suffix",
      },
      {
        path: ["objects", "example", "properties", "isArchived"],
        ruleId: "model/boolean-name",
      },
      {
        path: ["objects", "example", "properties", "numAttempts"],
        ruleId: "model/count-name",
      },
      {
        path: ["objects", "example", "properties", "regionCode"],
        ruleId: "model/standard-code-type",
      },
    ])
  })

  it("checks display names and choice labels across normalized model metadata", () => {
    const description = describeModel(Model)
    const example = description.objects[0]!
    const diagnostics = lintModelDescription({
      ...description,
      model: { name: "example" },
      objects: [
        {
          ...example,
          properties: {
            status: {
              ...schema.select({
                options: [{ label: "active", value: "active" }],
              }),
              immutable: false,
              nullable: false,
              outputOnly: false,
              requiredOnCreate: true,
            },
          },
        },
      ],
    })

    expect(diagnostics.map(({ path, ruleId }) => ({ path, ruleId }))).toEqual([
      {
        path: ["model", "name"],
        ruleId: "model/display-name-sentence-case",
      },
      {
        path: [
          "objects",
          "example",
          "properties",
          "status",
          "options",
          "0",
          "label",
        ],
        ruleId: "model/label-sentence-case",
      },
    ])
  })
})
