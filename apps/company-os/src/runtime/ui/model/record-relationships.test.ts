import { expect, it } from "vitest"

import { createEffectClient } from "#/runtime/client/create-client.ts"
import { createModelQueries } from "#/runtime/client/model-query-client.ts"
import {
  fixtureModel,
  Prospect,
  Account,
} from "#/runtime/testing/fixture-model.ts"
import { testPresentation } from "#/runtime/testing/presentation.ts"
import {
  recordRelationships,
  relationshipCapabilities,
} from "#/runtime/ui/model/record-relationships.ts"

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

it("uses all cardinality bounds when offering local changes", () => {
  expect(relationshipCapabilities({ min: 2, max: 4 }, undefined)).toEqual({
    canAdd: false,
    canRemove: false,
  })
  expect(relationshipCapabilities({ min: 2, max: 4 }, 2)).toEqual({
    canAdd: true,
    canRemove: false,
  })
  expect(relationshipCapabilities({ min: 2, max: 4 }, 4)).toEqual({
    canAdd: false,
    canRemove: true,
  })
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
