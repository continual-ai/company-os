import { expect, it } from "vitest"

import { createEffectClient } from "#/runtime/client/create-client.ts"
import { createModelQueries } from "#/runtime/client/model-query-client.ts"
import {
  fixtureModel,
  Prospect,
  Account,
} from "#/runtime/testing/fixture-model.ts"
import { testPresentation } from "#/runtime/testing/presentation.ts"
import { recordLinkViews } from "#/runtime/ui/model/record-link-views.ts"

it("does not offer creation through an action-owned link", () => {
  const data = createModelQueries(
    fixtureModel,
    createEffectClient(fixtureModel, { baseUrl: "https://unused.example" })
  )
  const runtime = { ...testPresentation(fixtureModel), data }
  const links = recordLinkViews(runtime, Prospect, {
    id: "prospect_test",
    etag: "1",
    objectType: "prospect",
    name: "Prospect",
    links: {},
  })
  const converted = links.find(({ key }) => key === "convertedAccount")!
  expect(converted).toBeDefined()
  expect(converted.creates).toEqual([])
  expect(converted.link).toBeUndefined()
})

it("offers plural creation immediately and singular creation only when empty", () => {
  const data = createModelQueries(
    fixtureModel,
    createEffectClient(fixtureModel, { baseUrl: "https://unused.example" })
  )
  const runtime = { ...testPresentation(fixtureModel), data }
  for (const occupied of [false, true]) {
    const links = recordLinkViews(runtime, fixtureModel.objects.person, {
      id: "person_test",
      etag: "1",
      objectType: "person",
      name: "Person",
      links: { billingAccount: occupied ? "account_test" : null },
    })
    const account = links.find(({ key }) => key === "billingAccount")!
    expect(account.creates.length > 0).toBe(!occupied)
  }
  const plural = recordLinkViews(runtime, Account, {
    id: "account_test",
    etag: "1",
    objectType: "account",
    name: "Account",
    links: {},
  }).find(({ key }) => key === "people")!
  expect(plural.creates.length).toBeGreaterThan(0)
  expect(plural.link).toBeDefined()
  expect(plural.unlink).toBeDefined()
})

it("hides link writes on system-managed records", () => {
  const data = createModelQueries(
    fixtureModel,
    createEffectClient(fixtureModel, { baseUrl: "https://unused.example" })
  )
  const runtime = { ...testPresentation(fixtureModel), data }
  const links = recordLinkViews(runtime, Account, {
    id: "account_system",
    etag: "1",
    objectType: "account",
    name: "System account",
    systemManaged: true,
    links: {},
  })
  const people = links.find(({ key }) => key === "people")!
  expect(people).toBeDefined()
  expect(people.creates).toEqual([])
  expect(people.link).toBeUndefined()
  expect(people.unlink).toBeUndefined()
})
