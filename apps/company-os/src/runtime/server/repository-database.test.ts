import { Effect } from "effect"
import { expect } from "vitest"

import { UserService } from "#/runtime/access/server/user-service.ts"
import {
  EmailAddress,
  DomainName,
  RecordId,
  modelObjectLinkTraversals,
} from "#/runtime/model/index.ts"
import { Database } from "#/runtime/server/database.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { operationsFor } from "#/runtime/server/operation-executor.ts"
import { Links } from "#/runtime/server/storage/link-store.ts"
import {
  Account,
  fixtureModel,
  Person,
} from "#/runtime/testing/fixture-model.ts"
import { FixtureServer } from "#/runtime/testing/fixture-server.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const fixture = testFoundation(fixtureModel, { servers: [FixtureServer] })
const implementation = operationsFor(fixtureModel)
const accountsOfPerson = modelObjectLinkTraversals(fixtureModel, Person).find(
  ({ traversal }) => traversal.key === "accounts"
)!
const peopleOfAccount = modelObjectLinkTraversals(fixtureModel, Account).find(
  ({ traversal }) => traversal.key === "people"
)!

fixture.test(
  "coordinates Link updates even when ordinary creation is disabled",
  () =>
    Effect.gen(function* () {
      const services = yield* implementation
      const links = yield* Links
      const account = yield* services.account.create({
        name: "Provisioned account",
      })
      const person = yield* services.person.create({
        name: "Provisioned person",
      })
      const accountCount = (yield* services.account.list({})).totalSize
      const invalidCreate = yield* services.account
        .create({
          name: "Must roll back",
          links: {
            people: [person.id, RecordId("person")("missing-person")],
          },
        })
        .pipe(Effect.flip)
      expect(invalidCreate).toMatchObject({ _tag: "ObjectNotFound" })
      expect((yield* services.account.list({})).totalSize).toBe(accountCount)
      const linkedAccount = yield* services.account.create({
        name: "Created with links",
        links: { people: [person.id] },
      })
      expect(
        (yield* links.list(accountsOfPerson, { id: person.id })).items
      ).toMatchObject([{ id: linkedAccount.id }])
      const user = yield* (yield* UserService).provision({
        name: "Person creator",
        email: EmailAddress("creator@example.test"),
      })
      const userInvocation = { actorId: user.id }
      const createFromPerson = () =>
        services.person
          .create({
            name: "Atomic person",
            links: { accounts: [account.id] },
          })
          .pipe(Effect.provideService(CurrentInvocation, userInvocation))
      const linkedPerson = yield* createFromPerson()
      expect(
        (yield* links.list(accountsOfPerson, { id: linkedPerson.id })).items
      ).toMatchObject([{ id: account.id, name: account.name }])
      // Keep the pagination fixture independent of the creation cases above.
      yield* services.person.delete({ id: linkedPerson.id })
      yield* services.account.delete({ id: linkedAccount.id })
      yield* services.account.update({
        id: account.id,
        etag: (yield* services.account.get({ id: account.id })).etag,
        links: { people: { add: [person.id] } },
      })
      expect(
        (yield* links.list(peopleOfAccount, { id: account.id })).items
      ).toMatchObject([
        { id: person.id, name: person.name, objectType: "person" },
      ])
      const another = yield* services.person.create({
        name: "A second person",
      })
      yield* services.person.create({ name: "A person outside this account" })
      yield* links.link(peopleOfAccount, { id: account.id, target: another.id })
      const request = {
        id: account.id,
        pageSize: 1,
        sort: [{ field: "name", direction: "asc" }],
      } as const
      const first = yield* links.list(peopleOfAccount, request)
      expect(first.items.map(({ id }) => id)).toEqual([another.id])
      expect(first.totalSize).toBe(2)
      const next = yield* links.list(peopleOfAccount, {
        ...request,
        pageToken: first.nextPageToken!,
      })
      expect(next.items.map(({ id }) => id)).toEqual([person.id])
      expect(next.nextPageToken).toBeNull()
      const filtered = yield* links.list(peopleOfAccount, {
        ...request,
        filter: { field: "name", operator: "contains", value: "Provisioned" },
      })
      expect(filtered.totalSize).toBe(1)
      expect(filtered.items.map(({ id }) => id)).toEqual([person.id])
      const otherAccount = yield* services.account.create({
        name: "Other account",
      })
      expect(
        yield* links
          .list(peopleOfAccount, {
            ...request,
            id: otherAccount.id,
            pageToken: first.nextPageToken!,
          })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "InvalidListRequest" })
      expect(
        yield* links
          .list(peopleOfAccount, {
            ...request,
            filter: {
              field: "name",
              operator: "contains",
              value: "Provisioned",
            },
            pageToken: first.nextPageToken!,
          })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "InvalidListRequest" })
    })
)

fixture.test(
  "public and trusted updates attribute scalar and Link changes once",
  () =>
    Effect.gen(function* () {
      const services = yield* implementation
      const account = yield* services.account.create({ name: "Version target" })
      for (const trusted of [false, true]) {
        const before = yield* services.person.create({ name: "Before" })
        const input = {
          id: before.id,
          name: "After",
          links: { accounts: [account.id] },
        }
        const after = yield* trusted
          ? (yield* Database).repository(Person).update(input)
          : services.person.update(input)
        expect(after.etag).toBe((BigInt(before.etag) + 1n).toString())
        expect(after.name).toBe("After")
        expect(after.links.accounts).toEqual({
          ids: [account.id],
          totalSize: 1,
          totalSizeExact: true,
        })
        expect(yield* services.person.get({ id: before.id })).toEqual(after)
      }
    })
)

fixture.test(
  "text fragments work on formatted fields and boolean aggregates fail before SQL",
  () =>
    Effect.gen(function* () {
      const services = yield* implementation
      const account = yield* services.account.create({
        name: "Acme",
        domain: DomainName("acme.com"),
      })
      const person = yield* services.person.create({
        name: "Alice",
        email: EmailAddress("alice@acme.com"),
        links: { billingAccount: account.id },
      })
      for (const filter of [
        { field: "email", operator: "contains", value: "@acme.com" },
        { field: "email", operator: "startsWith", value: "alice" },
        { field: "billingAccount.domain", operator: "contains", value: "acme" },
      ] as const) {
        const page = yield* services.person.list({ filter })
        expect(page.items.map(({ id }) => id)).toEqual([person.id])
      }
      expect(
        yield* services.person
          .list({
            sort: [
              {
                field: "accounts.systemManaged",
                aggregate: "min",
                direction: "asc",
              },
            ],
          })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "SchemaError" })
    })
)
