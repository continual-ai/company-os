import { expect, it } from "vitest"

import { createEffectClient } from "#/runtime/client/create-client.ts"
import { createModelQueries } from "#/runtime/client/model-query-client.ts"
import {
  fixtureModel,
  Prospect,
  Account,
} from "#/runtime/testing/fixture-model.ts"
import { testPresentation } from "#/runtime/testing/presentation.ts"
import { recordRelationships } from "#/runtime/ui/model/record-relationships.ts"

it("does not offer creation through an action-owned relationship", () => {
  const data = createModelQueries(
    fixtureModel,
    createEffectClient(fixtureModel, { baseUrl: "https://unused.example" })
  )
  const runtime = { ...testPresentation(fixtureModel), data }
  const relationships = recordRelationships(runtime, Prospect, {
    id: "prospect_test",
    etag: "1",
    objectType: "prospect",
    name: "Prospect",
    links: {},
  })
  const converted = relationships.find(({ key }) => key === "convertedAccount")!
  expect(converted).toBeDefined()
  expect(converted.creates).toEqual([])
  expect(converted.connect).toBeUndefined()
})

it("offers plural creation immediately and singular creation only when empty", () => {
  const data = createModelQueries(
    fixtureModel,
    createEffectClient(fixtureModel, { baseUrl: "https://unused.example" })
  )
  const runtime = { ...testPresentation(fixtureModel), data }
  for (const occupied of [false, true]) {
    const relationships = recordRelationships(
      runtime,
      fixtureModel.objects.person,
      {
        id: "person_test",
        etag: "1",
        objectType: "person",
        name: "Person",
        links: { billingAccount: occupied ? "account_test" : null },
      }
    )
    const account = relationships.find(({ key }) => key === "billingAccount")!
    expect(account.creates.length > 0).toBe(!occupied)
  }
  const plural = recordRelationships(runtime, Account, {
    id: "account_test",
    etag: "1",
    objectType: "account",
    name: "Account",
    links: {},
  }).find(({ key }) => key === "people")!
  expect(plural.creates.length).toBeGreaterThan(0)
  expect(plural.connect).toBeDefined()
  expect(plural.disconnect).toBeDefined()
})

it("hides relationship writes on system-managed records", () => {
  const data = createModelQueries(
    fixtureModel,
    createEffectClient(fixtureModel, { baseUrl: "https://unused.example" })
  )
  const runtime = { ...testPresentation(fixtureModel), data }
  const relationships = recordRelationships(runtime, Account, {
    id: "account_system",
    etag: "1",
    objectType: "account",
    name: "System account",
    systemManaged: true,
    links: {},
  })
  const people = relationships.find(({ key }) => key === "people")!
  expect(people).toBeDefined()
  expect(people.creates).toEqual([])
  expect(people.connect).toBeUndefined()
  expect(people.disconnect).toBeUndefined()
})
