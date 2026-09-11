import { Effect } from "effect"
import { expect } from "vitest"

import { UserService } from "#/runtime/access/server/user-service.ts"
import {
  EmailAddress,
  RecordId,
  modelObjectLinkTraversals,
} from "#/runtime/model/index.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { modelImplementation } from "#/runtime/server/model/implementation.ts"
import { Links } from "#/runtime/server/model/link-service.ts"
import {
  Account,
  fixtureModel,
  Person,
} from "#/runtime/testing/fixture-model.ts"
import { FixtureServer } from "#/runtime/testing/fixture-server.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const fixture = testFoundation(fixtureModel, { servers: [FixtureServer] })
const implementation = modelImplementation(fixtureModel)
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
      const { services } = yield* implementation
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
      // Initializing from the non-writable end must still require the existing owner's update permission.
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
