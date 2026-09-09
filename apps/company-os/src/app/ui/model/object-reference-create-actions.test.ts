import { describe, expect, it } from "vitest"

import { Model } from "#/app.model.ts"
import { presentation } from "#/app/app-presentation.ts"
import { creatableReferenceObjects } from "#/runtime/ui/model/object-reference-create-actions.tsx"

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
