import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import { defineObject, schema } from "#/runtime/model/index.ts"
import { fixtureModel } from "#/runtime/testing/fixture-model.ts"
import { testPresentation } from "#/runtime/testing/presentation.ts"
import { objectPropertyValue } from "#/runtime/ui/model/object-property-value.tsx"
import {
  objectTableCellBehavior,
  parseObjectTableCellInput,
} from "#/runtime/ui/model/object-table/object-table-cell-types.ts"
import { ObjectTableCell } from "#/runtime/ui/model/object-table/object-table-cell.tsx"

const Review = defineObject({
  id: "review",
  collection: "reviews",
  name: "Review",
  pluralName: "Reviews",
  properties: {
    name: schema.string(),
    score: schema.score({ label: "Score", nullable: true }),
    requiredScore: schema.score(),
  },
  display: { title: "name" },
})

it("renders a numeric meter consistently in record properties and table cells, preserving zero", () => {
  for (const value of [0, 49, 78, 99]) {
    const property = renderToStaticMarkup(
      <>
        {objectPropertyValue(
          testPresentation(fixtureModel),
          Review,
          "score",
          value,
          new Map()
        )}
      </>
    )
    const cell = renderToStaticMarkup(
      <ObjectTableCell
        property={Review.properties.score}
        value={value}
        active={false}
        editing={false}
        expandActive={false}
        onCancelEditing={() => undefined}
        onEditingChange={() => undefined}
      />
    )
    for (const html of [property, cell]) {
      expect(html).toContain('role="meter"')
      expect(html).toContain(`aria-valuenow="${value}"`)
      expect(html).toContain('aria-valuemax="100"')
      expect(html).not.toContain("Empty")
    }
  }
})

it("uses numeric filtering and validates score edits without coercing empty to zero", () => {
  const property = Review.properties.score
  expect(objectTableCellBehavior(property).filterFamily).toBe("number")
  expect(parseObjectTableCellInput(property, "")).toEqual({ value: null })
  expect(parseObjectTableCellInput(property, "0")).toEqual({ value: 0 })
  expect(parseObjectTableCellInput(property, "100")).toEqual({ value: 100 })
  for (const input of ["-1", "101", "1.5", "NaN", "Infinity"]) {
    expect(parseObjectTableCellInput(property, input)).toHaveProperty("error")
  }
  expect(
    parseObjectTableCellInput(Review.properties.requiredScore, "")
  ).toHaveProperty("error")
})
