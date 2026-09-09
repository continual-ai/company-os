import { describe, expect, it } from "vitest"

import { Identity } from "#/runtime/access/model/index.ts"
import {
  Account,
  fixtureModel,
  Participant,
} from "#/runtime/testing/fixture-model.ts"
import { testPresentation } from "#/runtime/testing/presentation.ts"
import { creatableReferenceObjects } from "#/runtime/ui/model/object-reference-create-actions.tsx"

const presentation = testPresentation(fixtureModel)

describe("creatableReferenceObjects", () => {
  it("uses the closed model as the creation registry", () => {
    expect(
      new Set(
        creatableReferenceObjects(presentation, Participant.id).map(
          ({ id }) => id
        )
      )
    ).toEqual(new Set(["account", "person"]))
    expect(
      creatableReferenceObjects(presentation, Account.id).map(({ id }) => id)
    ).toEqual(["account"])
  })

  it("excludes object types without the standard create Action", () => {
    expect(creatableReferenceObjects(presentation, Identity.id)).toEqual([])
  })
})
