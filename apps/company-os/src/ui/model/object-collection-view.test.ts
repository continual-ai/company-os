import { describe, expect, it } from "vitest"

import {
  objectCollectionStateSearch,
  resolveObjectCollectionView,
  validateObjectCollectionSearch,
  type ObjectCollectionView,
} from "./object-collection-view"

const views: ReadonlyArray<ObjectCollectionView> = [
  {
    id: "all",
    label: "All records",
    state: { filters: [], sorting: [], visibility: { name: true } },
  },
  {
    id: "active",
    label: "Active",
    state: {
      filters: [
        {
          id: "status",
          value: { operator: "equals", values: ["active"] },
        },
      ],
      sorting: [{ desc: false, id: "name" }],
      visibility: { name: true, status: true },
    },
  },
]

describe("object collection view state", () => {
  it("resolves source-defined views and ignores unknown view ids", () => {
    expect(resolveObjectCollectionView(views, { view: "active" }).view.id).toBe(
      "active"
    )
    expect(
      resolveObjectCollectionView(views, { view: "missing" }).view.id
    ).toBe("all")
  })

  it("round-trips validated user overrides through the URL", () => {
    const selected = views[1]!
    const state = {
      filters: selected.state.filters,
      sorting: [{ desc: true, id: "name" }],
      visibility: { name: true, status: false },
    }
    const search = objectCollectionStateSearch(selected, state)

    expect(resolveObjectCollectionView(views, search)).toEqual({
      state,
      view: selected,
    })
  })

  it("rejects malformed URL state at the route boundary", () => {
    expect(() =>
      validateObjectCollectionSearch({ state: { filters: "everything" } })
    ).toThrow()
  })
})
