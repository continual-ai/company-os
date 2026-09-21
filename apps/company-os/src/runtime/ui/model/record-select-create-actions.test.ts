import { describe, expect, it } from "vitest"

import { Identity } from "#/runtime/access/model/index.ts"
import {
  Account,
  fixtureModel,
  Participant,
} from "#/runtime/testing/fixture-model.ts"
import { testPresentation } from "#/runtime/testing/presentation.ts"
import { creatableRecordTypes } from "#/runtime/ui/model/record-select-create-actions.tsx"

const presentation = testPresentation(fixtureModel)

describe("creatableRecordTypes", () => {
  it("uses the closed model as the creation registry", () => {
    expect(
      new Set(
        creatableRecordTypes(presentation, Participant.id).map(({ id }) => id)
      )
    ).toEqual(new Set(["account", "person"]))
    expect(
      creatableRecordTypes(presentation, Account.id).map(({ id }) => id)
    ).toEqual(["account"])
  })

  it("excludes object types without the standard create Action", () => {
    expect(creatableRecordTypes(presentation, Identity.id)).toEqual([])
  })
})
