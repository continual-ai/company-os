import { Model } from "@company/model"
import { describe, expect, it } from "vitest"

import { creatableReferenceObjects } from "./object-reference-create-actions"

describe("creatableReferenceObjects", () => {
  it("uses the closed model as the creation registry", () => {
    expect(
      new Set(
        creatableReferenceObjects(Model.interfaces.party.id).map(({ id }) => id)
      )
    ).toEqual(new Set(["company", "contact"]))
    expect(
      creatableReferenceObjects(Model.objects.company.id).map(({ id }) => id)
    ).toEqual(["company"])
  })

  it("excludes object types without the standard create Action", () => {
    expect(creatableReferenceObjects(Model.interfaces.identity.id)).toEqual([])
  })
})
