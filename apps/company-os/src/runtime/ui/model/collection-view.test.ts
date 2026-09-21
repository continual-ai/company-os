import { expect, it } from "vitest"

import {
  defineLink,
  defineModel,
  defineModule,
  defineObject,
  schema,
} from "#/runtime/model/index.ts"
import {
  objectFields,
  orderObjectFields,
} from "#/runtime/model/object-fields.ts"
import { defineCollectionView } from "#/runtime/ui/model/collection-view.ts"
import { validateObjectCollectionSearch } from "#/runtime/ui/model/object-collection-view.ts"

const Item = defineObject({
  id: "item",
  name: "Item",
  pluralName: "Items",
  collection: "items",
  properties: {
    name: schema.string(),
    state: schema.select({
      options: [
        { value: "planned", label: "Planned" },
        { value: "done", label: "Done" },
      ],
    }),
    startDate: schema.date({ nullable: true }),
    finishDate: schema.date({ nullable: true }),
    quantity: schema.number(),
  },
  display: { title: "name" },
})
const Children = defineLink({
  id: "children",
  from: { object: Item, key: "parent", max: 1 },
  to: { object: Item, key: "children" },
})
const model = defineModel({
  name: "View tests",
  modules: [
    defineModule({
      id: "items",
      name: "Items",
      objects: [Item],
      links: [Children],
    }),
  ],
})

it("preserves authored order through URL state and field discovery", () => {
  const view = defineCollectionView(model, Item, "schedule", "Schedule", {
    columns: ["name", "parent", "quantity", "state", "children.state"],
    layout: { type: "gantt", start: "startDate", end: "finishDate" },
    filters: [
      {
        id: "children.state",
        value: { quantifier: "none", operator: "notEquals", values: ["done"] },
      },
    ],
    sorting: [{ id: "children.$count", desc: true }],
  })
  const decoded = validateObjectCollectionSearch({ state: view.state })
  expect(decoded.state?.columns).toEqual([
    "name",
    "parent",
    "quantity",
    "state",
    "children.state",
  ])
  const ordered = orderObjectFields(
    objectFields(Item, model),
    decoded.state?.columns
  )
  expect(
    ordered
      .filter(({ id }) => decoded.state?.columns?.includes(id))
      .map(({ id }) => id)
  ).toEqual(view.state.columns)
  expect(new Set(ordered.map(({ id }) => id)).size).toBe(ordered.length)
})

it("rejects stale fields, enum values, and unsuitable schedule mappings at both boundaries", () => {
  expect(() =>
    defineCollectionView(model, Item, "bad", "Bad", {
      // @ts-expect-error Fields come from this model and object.
      columns: ["missing"],
    })
  ).toThrow("Unknown field")
  expect(() =>
    defineCollectionView(model, Item, "bad", "Bad", {
      columns: ["name"],
      filters: [
        // @ts-expect-error Filter values come from the selected enum, including related enums.
        {
          id: "children.state",
          value: { operator: "equals", values: ["started"] },
        },
      ],
    })
  ).toThrow()
  expect(() =>
    defineCollectionView(model, Item, "bad", "Bad", {
      columns: ["name"],
      // @ts-expect-error Schedules require date fields.
      layout: { type: "calendar", start: "name" },
    })
  ).toThrow("date field")
  expect(() =>
    defineCollectionView(model, Item, "bad", "Bad", {
      columns: ["name"],
      // @ts-expect-error Boards require enum fields.
      layout: { type: "kanban", groupBy: "name" },
    })
  ).toThrow("select field")
  expect(() =>
    defineCollectionView(model, Item, "bad", "Bad", {
      columns: ["name"],
      // @ts-expect-error Plural related values cannot be sorted without an aggregate.
      sorting: [{ id: "children.state", desc: false }],
    })
  ).toThrow("sort")
})

it("rejects incomplete authored filters and unsupported null operators", () => {
  expect(() =>
    defineCollectionView(model, Item, "empty", "Empty", {
      columns: ["name"],
      filters: [
        // @ts-expect-error Non-nullable properties cannot be empty.
        { id: "state", value: { operator: "empty", values: [] } },
      ],
    })
  ).toThrow("not supported")
  expect(() =>
    defineCollectionView(model, Item, "draft", "Draft", {
      columns: ["name"],
      filters: [{ id: "state", value: { operator: "equals", values: [] } }],
    })
  ).toThrow("requires a value")
  expect(() =>
    defineCollectionView(model, Item, "date", "Date", {
      columns: ["name"],
      filters: [
        {
          id: "startDate",
          value: { operator: "onOrAfter", values: ["2026-09-21"] },
        },
        { id: "parent.state", value: { operator: "empty", values: [] } },
      ],
    })
  ).not.toThrow()
})
