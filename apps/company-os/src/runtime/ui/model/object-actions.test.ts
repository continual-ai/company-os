import { expect, it } from "vitest"

import { User } from "#/runtime/access/model/user.ts"
import { fixtureModel } from "#/runtime/testing/fixture-model.ts"
import { Account, Prospect } from "#/runtime/testing/fixture-model.ts"
import { objectActionAvailable } from "#/runtime/ui/model/object-actions.ts"

it("offers installed collection actions and protects missing or system records", () => {
  const record = { id: "prospect_1", etag: "1", systemManaged: false }
  expect(objectActionAvailable(fixtureModel, Account, "create")).toBe(true)
  expect(objectActionAvailable(fixtureModel, User, "create")).toBe(false)
  expect(objectActionAvailable(fixtureModel, Prospect, "convert")).toBe(false)
  expect(objectActionAvailable(fixtureModel, Prospect, "convert", record)).toBe(
    true
  )
  expect(
    objectActionAvailable(fixtureModel, Prospect, "convert", {
      ...record,
      systemManaged: true,
    })
  ).toBe(false)
  expect(
    objectActionAvailable(fixtureModel, Account, "get", {
      ...record,
      systemManaged: true,
    })
  ).toBe(true)
  expect(objectActionAvailable(fixtureModel, Account, "missing", record)).toBe(
    false
  )
})
