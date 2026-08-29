import { describe, expect, it } from "vitest"

import { defineInterface } from "./definition/interface"
import { defineModel } from "./definition/model"
import { defineModule } from "./definition/module"
import { defineObject } from "./definition/object"
import { defineRoot } from "./definition/root"
import { schema } from "./definition/schema"
import { describeModel } from "./description"
import { lintModelDescription } from "./model-lint"

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
