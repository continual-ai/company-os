import { describe, expect, it } from "vitest"

import {
  objectRecordTabSearch,
  validateObjectRecordSearch,
} from "#/runtime/ui/model/object-record-view.ts"

describe("object record view", () => {
  it("decodes a relationship tab from URL search", () => {
    expect(validateObjectRecordSearch({ tab: "notes" })).toEqual({
      tab: "notes",
    })
  })

  it("omits the default overview tab from the URL", () => {
    expect(objectRecordTabSearch("overview")).toEqual({})
    expect(objectRecordTabSearch("contacts")).toEqual({ tab: "contacts" })
  })
})
