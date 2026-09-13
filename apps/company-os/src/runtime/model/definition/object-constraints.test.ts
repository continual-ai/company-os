import { expect, expectTypeOf, it } from "vitest"

import { defineLink } from "#/runtime/model/definition/link.ts"
import { defineModel } from "#/runtime/model/definition/model.ts"
import { defineModule } from "#/runtime/model/definition/module.ts"
import { defineObject } from "#/runtime/model/definition/object.ts"
import { schema } from "#/runtime/model/definition/schema.ts"
import { queryDependencies } from "#/runtime/model/query-dependencies.ts"
import { resolveQueryField } from "#/runtime/model/query-fields.ts"

const Range = {
  id: "range",
  collection: "ranges",
  name: "Range",
  pluralName: "Ranges",
  properties: {
    start: schema.date(),
    end: schema.date(),
    name: schema.string(),
    value: schema.number(),
  },
  display: { title: "name" },
} as const

it("rejects comparisons that PostgreSQL cannot enforce with consistent ordering", () => {
  for (const right of ["name", "value"] as const)
    expect(() =>
      defineObject({
        ...Range,
        checks: {
          dates: {
            left: "start",
            operator: "lte",
            right,
            message: "Invalid dates",
          },
        },
      })
    ).toThrow("matching ordered fields")
  expect(() =>
    defineObject({
      ...Range,
      // @ts-expect-error Checks must reference declared properties.
      checks: {
        dates: {
          left: "missing",
          operator: "lte",
          right: "end",
          message: "Invalid dates",
        },
      },
    })
  ).toThrow("matching ordered fields")
  expect(() =>
    defineObject({
      ...Range,
      checks: {
        dates: { left: "start", operator: "lte", right: "end", message: " " },
      },
    })
  ).toThrow("a message")
  expect(() => defineObject({ ...Range, display: { title: [] } })).toThrow(
    "at least one field"
  )
})

function titledModel(title: ReadonlyArray<string>, max?: 1) {
  const Target = defineObject(Range)
  const Membership = defineObject({
    id: "membership",
    collection: "memberships",
    name: "Membership",
    pluralName: "Memberships",
    properties: {},
    display: { title },
  })
  return defineModel({
    name: "Titles",
    modules: [
      defineModule({
        id: "titles",
        name: "Titles",
        objects: [Target, Membership],
        links: [
          defineLink({
            id: "membershipTarget",
            from: {
              type: Membership,
              key: "target",
              ...(max === undefined ? {} : { max }),
            },
            to: { type: Target, key: "memberships" },
          }),
        ],
      }),
    ],
  })
}

it("validates title traversals and tracks their cache dependencies without requiring expansion", () => {
  const model = titledModel(["target.name"], 1)
  expectTypeOf(model.objects.membership.display.title).toEqualTypeOf<"label">()
  expect(queryDependencies(model, [model.objects.membership], {})).toEqual([
    "membership",
    "range",
  ])
  expect(
    queryDependencies(model, [model.objects.range], { expand: true })
  ).toEqual(["range", "membership"])
  expect(() => titledModel(["createdAt"], 1)).toThrow(
    "must be a scalar property"
  )
  expect(() => titledModel(["target.missing"], 1)).toThrow("Unknown field")
  expect(() => titledModel(["target.name"])).toThrow("requires a quantifier")
  expect(() => titledModel(["target.$count"], 1)).toThrow(
    "must be a scalar property"
  )
  expect(() => titledModel(["target.memberships.id"], 1)).toThrow(
    "requires a quantifier"
  )
  expect(() =>
    resolveQueryField(model, model.objects.membership, "target.label")
  ).toThrow("stored fields")
})
