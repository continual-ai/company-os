import { describe, expect, it } from "vitest"

import {
  objectTableNavigationInitialState,
  reduceObjectTableNavigationState,
  type ObjectTableCellAddress,
} from "#/runtime/ui/model/object-table/object-table-navigation.ts"

const firstCell: ObjectTableCellAddress = {
  columnId: "name",
  rowId: "northwind",
}

describe("object table navigation", () => {
  it("moves from editing to selected to unselected with Escape actions", () => {
    const editing = reduceObjectTableNavigationState(
      objectTableNavigationInitialState,
      { type: "edit", address: firstCell }
    )

    const selected = reduceObjectTableNavigationState(editing, {
      type: "cancel-editing",
      address: firstCell,
    })
    expect(selected).toEqual({ activeCell: firstCell, editingCell: null })

    const unselected = reduceObjectTableNavigationState(selected, {
      type: "clear",
    })
    expect(unselected).toEqual(objectTableNavigationInitialState)
  })
})
