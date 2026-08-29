import { describe, expect, it } from "vitest"

import {
  objectRecordTabSearch,
  validateObjectRecordSearch,
} from "./object-record-view"

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
