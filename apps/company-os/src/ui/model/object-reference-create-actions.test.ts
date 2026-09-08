import { creatableReferenceObjects } from "@company/runtime/ui/model/object-reference-create-actions"
import { describe, expect, it } from "vitest"

import { Model } from "#/examples/model.ts"
import { presentation } from "#/examples/presentation.ts"

describe("creatableReferenceObjects", () => {
  it("uses the closed model as the creation registry", () => {
    expect(
      new Set(
        creatableReferenceObjects(presentation, Model.interfaces.party.id).map(
          ({ id }) => id
        )
      )
    ).toEqual(new Set(["company", "contact"]))
    expect(
      creatableReferenceObjects(presentation, Model.objects.company.id).map(
        ({ id }) => id
      )
    ).toEqual(["company"])
  })

  it("excludes object types without the standard create Action", () => {
    expect(
      creatableReferenceObjects(presentation, Model.interfaces.identity.id)
    ).toEqual([])
  })
})
