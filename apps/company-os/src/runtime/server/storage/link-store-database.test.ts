import { Effect } from "effect"
import { expect } from "vitest"

import {
  defineLink,
  defineModel,
  defineModule,
  defineObject,
  modelObjectLinkTraversals,
  RecordId,
  schema,
} from "#/runtime/model/index.ts"
import { linkPreview } from "#/runtime/model/record-links.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { withApiErrors } from "#/runtime/server/api-error.ts"
import { operationsFor } from "#/runtime/server/operation-executor.ts"
import { createRecordBatchGet } from "#/runtime/server/record-batch.ts"
import { makeRecordHydration } from "#/runtime/server/storage/hydration.ts"
import { eventJournal } from "#/runtime/server/storage/infrastructure.ts"
import { Links } from "#/runtime/server/storage/link-store.ts"
import { RecordStore } from "#/runtime/server/storage/record-store.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"
import {
  FixtureModule,
  Person,
  Participant,
  Account,
  Prospect,
  type Order,
} from "#/runtime/testing/fixture-model.ts"
import { FixtureServer } from "#/runtime/testing/fixture-server.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const Team = defineObject({
  id: "team",
  collection: "teams",
  name: "Team",
  pluralName: "Teams",
  properties: { name: schema.string() },
  display: { title: "name" },
})
const Members = defineLink({
  id: "teamMembers",
  name: "Team members",
  from: { type: Team, key: "members", label: "Members", min: 1, max: 2 },
  to: { type: Person, key: "teams", label: "Teams" },
})
const Partners = defineLink({
  id: "teamPartners",
  from: { type: Team, key: "partners" },
  to: { type: Participant, key: "partnerTeams" },
})
const model = defineModel({
  name: "Links",
  modules: [
    PlatformModule,
    FixtureModule,
    defineModule({
      id: "teams",
      name: "Teams",
      objects: [Team],
      links: [Members, Partners],
    }),
  ],
})
const fixture = testFoundation(model, { servers: [FixtureServer] })
const implementation = operationsFor(model)
const traversal = (
  object:
    | typeof Person
    | typeof Account
    | typeof Order
    | typeof Team
    | typeof Prospect,
  key: string
) =>
  modelObjectLinkTraversals(model, object).find(
    (item) => item.traversal.key === key
  )!

fixture.test(
  "returns bounded IDs and exact counts consistently, with polymorphic hydration",
  () =>
    Effect.gen(function* () {
      const services = yield* implementation
      const account = yield* services.account.create({ name: "Shared" })
      const people = yield* Effect.forEach([1, 2, 3, 4, 5], (n) =>
        services.person.create({
          name: `Person ${n}`,
          links: { accounts: [account.id] },
        })
      )
      const { sql } = yield* SqlDatabase
      const snapshots = yield* sql<{
        data: unknown
      }>`select data from ${eventJournal} where type = 'person.created' and data->>'id' = ${people[0]!.id}`
      expect(snapshots[0]?.data).toEqual(people[0])
      const record = yield* services.account.get({ id: account.id })
      expect(record.links.people).toEqual({
        ids: people
          .map((person) => person.id)
          .sort()
          .slice(0, 3),
        totalSize: 5,
      })
      expect(record.objectType).toBe("account")
      expect(
        (yield* services.account.batchGet({ ids: [account.id] })).items[0]
      ).toEqual(record)
      expect(
        (yield* services.account.list({
          filter: { field: "id", operator: "eq", value: account.id },
        })).items[0]
      ).toEqual(record)
      const batch = yield* createRecordBatchGet(model)({
        ids: [people[0]!.id, account.id, people[0]!.id, "missing"],
      })
      expect(batch.items.map((item) => item.objectType)).toEqual([
        "person",
        "account",
      ])
      expect(batch.items[1]).toEqual(record)
      expect(batch.missingIds).toEqual(["missing"])
      expect(
        (yield* services.person.list({
          filter: { link: "accounts", contains: account.id },
        })).totalSize
      ).toBe(5)
      expect(
        (yield* services.person.list({
          filter: { link: "accounts", isEmpty: true },
        })).totalSize
      ).toBe(0)
    })
)

fixture.test(
  "enforces final bounds and atomic replacement without coupling independent links",
  () =>
    Effect.gen(function* () {
      const services = yield* implementation
      const links = yield* Links
      const people = yield* Effect.forEach([1, 2, 3], (n) =>
        services.person.create({ name: `Member ${n}` })
      )
      const first = people[0]!,
        second = people[1]!,
        third = people[2]!
      const team = yield* services.team.create({
        name: "Small team",
        links: { members: [first.id] },
      })
      expect(
        yield* withApiErrors(
          links.unlink(traversal(Team, "members"), {
            id: team.id,
            target: first.id,
          })
        ).pipe(Effect.flip)
      ).toMatchObject({ status: "FAILED_PRECONDITION" })
      yield* services.team.update({
        id: team.id,
        links: { members: [second.id] },
      })
      expect(
        linkPreview((yield* services.team.get({ id: team.id })).links.members)
          .ids
      ).toEqual([second.id])
      // Adding through the reverse traversal observes the forward maximum too.
      yield* links.link(traversal(Person, "teams"), {
        id: first.id,
        target: team.id,
      })
      expect(
        yield* withApiErrors(
          links.link(traversal(Person, "teams"), {
            id: third.id,
            target: team.id,
          })
        ).pipe(Effect.flip)
      ).toMatchObject({ status: "FAILED_PRECONDITION" })
      const account = yield* services.account.create({ name: "Membership" })
      yield* services.person.update({
        id: first.id,
        links: { billingAccount: account.id },
      })
      expect(
        (yield* services.person.get({ id: first.id })).links.billingAccount
      ).toBe(account.id)
      yield* services.person.update({
        id: first.id,
        links: {
          accounts: { add: [account.id] },
          billingAccount: account.id,
        },
      })
      yield* links.unlink(traversal(Person, "accounts"), {
        id: first.id,
        target: account.id,
      })
      expect(
        (yield* services.person.get({ id: first.id })).links.billingAccount
      ).toBe(account.id)
      yield* services.person.update({
        id: first.id,
        links: {
          accounts: { remove: [account.id] },
          billingAccount: null,
        },
      })
      expect(
        linkPreview(
          (yield* services.person.get({ id: first.id })).links.accounts
        ).totalSize
      ).toBe(0)
    })
)

fixture.test(
  "cascades only explicitly owned records and validates survivors after deletion",
  () =>
    Effect.gen(function* () {
      const services = yield* implementation
      const account = yield* services.account.create({ name: "Owner" })
      const order = yield* services.order.create({
        name: "Purchase",
        links: { account: account.id },
      })
      const line = yield* services.orderLine.create({
        name: "Delivery",
        links: { order: order.id },
      })
      expect(
        yield* withApiErrors(services.account.delete({ id: account.id })).pipe(
          Effect.flip
        )
      ).toMatchObject({ status: "FAILED_PRECONDITION" })
      yield* services.order.delete({ id: order.id })
      expect(
        (yield* createRecordBatchGet(model)({
          ids: [order.id, line.id, account.id],
        })).items.map((item) => item.id)
      ).toEqual([account.id])
      expect(
        linkPreview(
          (yield* services.account.get({ id: account.id })).links.orders
        ).totalSize
      ).toBe(0)
    })
)

fixture.test("serializes competing additions without exceeding a maximum", () =>
  Effect.gen(function* () {
    const services = yield* implementation
    const links = yield* Links
    const protectedAccount = yield* services.account.create({
      name: "Protected outcome",
    })
    const prospect = yield* services.prospect.create({ name: "Unconverted" })
    for (const [link, id, target] of [
      [
        traversal(Prospect, "convertedAccount"),
        prospect.id,
        protectedAccount.id,
      ],
      [
        traversal(Account, "convertedProspects"),
        protectedAccount.id,
        prospect.id,
      ],
    ] as const)
      expect(
        yield* withApiErrors(links.link(link, { id, target })).pipe(Effect.flip)
      ).toMatchObject({ status: "INVALID_ARGUMENT" })
    const people = yield* Effect.forEach([1, 2, 3], (n) =>
      services.person.create({ name: `Concurrent ${n}` })
    )
    const team = yield* services.team.create({
      name: "Capacity",
      links: { members: [people[0]!.id] },
    })
    const results = yield* Effect.forEach(
      people.slice(1),
      (person) =>
        withApiErrors(
          links.link(traversal(Team, "members"), {
            id: team.id,
            target: person.id,
          })
        ).pipe(Effect.result),
      { concurrency: 2 }
    )
    expect(results.filter((result) => result._tag === "Success")).toHaveLength(
      1
    )
    expect(
      linkPreview((yield* services.team.get({ id: team.id })).links.members)
        .totalSize
    ).toBe(2)
    // A transaction may replace a required edge by deleting then inserting it.
    const database = yield* SqlDatabase
    yield* database.transaction(() =>
      Effect.gen(function* () {
        yield* services.team.update({
          id: team.id,
          links: { members: [people[0]!.id] },
        })
        yield* links.unlink(traversal(Team, "members"), {
          id: team.id,
          target: people[0]!.id,
        })
        yield* links.link(traversal(Team, "members"), {
          id: team.id,
          target: people[1]!.id,
        })
      })
    )
    expect(
      linkPreview(
        (yield* (yield* RecordStore).get(Team).get(team.id)).links.members
      ).ids
    ).toEqual([people[1]!.id])
  })
)

fixture.test("filters and sorts complete relationships before pagination", () =>
  Effect.gen(function* () {
    const services = yield* implementation
    const alpha = yield* services.account.create({ name: "Alpha" })
    const beta = yield* services.account.create({ name: "Beta" })
    const first = yield* services.person.create({
      name: "First",
      links: { accounts: [alpha.id, beta.id], billingAccount: beta.id },
    })
    const second = yield* services.person.create({
      name: "Second",
      links: { accounts: [alpha.id], billingAccount: alpha.id },
    })
    yield* services.person.create({ name: "Empty" })
    const some = {
      link: "accounts",
      some: { field: "name", operator: "eq", value: "Beta" },
    } as const
    expect(
      (yield* services.person.list({ filter: some })).items.map((x) => x.id)
    ).toEqual([first.id])
    expect(
      (yield* services.person.list({
        filter: {
          link: "accounts",
          none: { field: "name", operator: "eq", value: "Beta" },
        },
      })).totalSize
    ).toBe(2)
    expect(
      (yield* services.person.list({
        filter: {
          link: "accounts",
          every: { field: "name", operator: "eq", value: "Alpha" },
        },
      })).totalSize
    ).toBe(2)
    expect(
      (yield* services.person.list({
        filter: {
          field: "billingAccount.name",
          operator: "eq",
          value: "Alpha",
        },
      })).items.map((x) => x.id)
    ).toEqual([second.id])
    const sort = [
      { field: "accounts", aggregate: "count", direction: "desc" },
    ] as const
    const page = yield* services.person.list({ sort, pageSize: 1 })
    expect(page.items.map((x) => x.id)).toEqual([first.id])
    expect(page.totalSize).toBe(3)
    const next = yield* services.person.list({
      sort,
      pageSize: 1,
      pageToken: page.nextPageToken!,
    })
    expect(next.items.map((x) => x.id)).toEqual([second.id])
    expect(
      (yield* services.person.list({
        sort: [{ field: "billingAccount.name", direction: "asc" }],
        pageSize: 1,
      })).items[0]?.id
    ).toBe(second.id)
    expect(
      yield* withApiErrors(
        services.person.list({
          sort: [
            { field: "accounts.name", aggregate: "min", direction: "desc" },
          ],
          pageToken: page.nextPageToken!,
        })
      ).pipe(Effect.flip)
    ).toMatchObject({ status: "INVALID_ARGUMENT" })
  })
)

fixture.test(
  "queries shared Interface fields with complete polymorphic records",
  () =>
    Effect.gen(function* () {
      const services = yield* implementation
      const links = yield* Links
      const person = yield* services.person.create({ name: "Beta" })
      const account = yield* services.account.create({ name: "Alpha" })
      const team = yield* services.team.create({
        name: "Shared",
        links: { members: [person.id], partners: [person.id, account.id] },
      })
      const relation = traversal(Team, "partners")
      const first = yield* links.list(relation, {
        id: team.id,
        pageSize: 1,
        sort: [{ field: "name", direction: "asc" }],
      })
      expect(first.items[0]).toMatchObject({
        id: account.id,
        objectType: "account",
        name: "Alpha",
      })
      expect(first.totalSize).toBe(2)
      const next = yield* links.list(relation, {
        id: team.id,
        pageSize: 1,
        sort: [{ field: "name", direction: "asc" }],
        pageToken: first.nextPageToken!,
      })
      expect(next.items[0]).toMatchObject({
        id: person.id,
        objectType: "person",
        name: "Beta",
      })
      expect(
        (yield* links.list(relation, {
          id: team.id,
          filter: { field: "name", operator: "eq", value: "Alpha" },
        })).totalSize
      ).toBe(1)
      expect(
        (yield* services.team.list({
          filter: {
            link: "partners",
            some: { field: "name", operator: "eq", value: "Beta" },
          },
        })).totalSize
      ).toBe(1)
    })
)

fixture.test(
  "uses deltas safely with truncated previews and rejects stale link writes",
  () =>
    Effect.gen(function* () {
      const services = yield* implementation
      const links = yield* Links
      const person = yield* services.person.create({ name: "One" })
      const accounts = yield* Effect.forEach([1, 2, 3, 4, 5], (n) =>
        services.account.create({ name: `Account ${n}` })
      )
      yield* services.person.update({
        id: person.id,
        links: { accounts: accounts.map((x) => x.id) },
      })
      const preview = yield* services.person.get({ id: person.id })
      expect(linkPreview(preview.links.accounts).ids).toHaveLength(3)
      yield* services.person.update({
        id: person.id,
        etag: preview.etag,
        links: { accounts: { remove: [accounts[0]!.id] } },
      })
      expect(
        linkPreview(
          (yield* services.person.get({ id: person.id })).links.accounts
        ).totalSize
      ).toBe(4)
      expect(
        yield* withApiErrors(
          links.link(traversal(Person, "accounts"), {
            id: person.id,
            target: accounts[0]!.id,
            etag: preview.etag,
          })
        ).pipe(Effect.flip)
      ).toMatchObject({ status: "ABORTED" })
      yield* services.person.update({ id: person.id, links: { accounts: [] } })
      expect(
        linkPreview(
          (yield* services.person.get({ id: person.id })).links.accounts
        ).totalSize
      ).toBe(0)
    })
)

fixture.test(
  "expands one hop with complete records and bounded plural previews",
  () =>
    Effect.gen(function* () {
      const services = yield* implementation
      const accounts = yield* Effect.forEach([0, 1, 2, 3], (n) =>
        services.account.create({ name: `Account ${n}` })
      )
      const person = yield* services.person.create({
        name: "Reader",
        links: {
          billingAccount: accounts[0]!.id,
          accounts: accounts.map((record) => record.id),
        },
      })
      const plain = yield* services.person.get({ id: person.id })
      expect(plain.links.billingAccount).toBe(accounts[0]!.id)
      const expanded = yield* services.person.get({
        id: person.id,
        expand: true,
      })
      expect(expanded.links.billingAccount?.name).toBe("Account 0")
      expect(expanded.links.accounts.items).toHaveLength(3)
      expect(expanded.links.accounts.totalSize).toBe(4)
      expect(expanded.links.accounts.items.map((record) => record.id)).toEqual(
        plain.links.accounts.ids
      )
      expect(expanded.links.billingAccount?.links.people.ids).toEqual([
        person.id,
      ])
      const selected = yield* services.person.list({
        expand: { billingAccount: true },
      })
      expect(selected.items[0]!.links.billingAccount?.objectType).toBe(
        "account"
      )
      expect(selected.items[0]!.links.accounts.ids).toHaveLength(3)
      const batch = yield* services.person.batchGet({
        ids: [person.id],
        expand: true,
      })
      expect(batch.items).toEqual([expanded])
      const mixed = yield* createRecordBatchGet(model)({
        ids: [person.id, accounts[0]!.id],
        expand: true,
      })
      expect(mixed.items).toHaveLength(2)
      expect(mixed.missingIds).toEqual([])
    })
)

fixture.test(
  "rejects invalid expansion instead of silently returning incomplete records",
  () =>
    Effect.gen(function* () {
      const services = yield* implementation
      const hydration = yield* makeRecordHydration
      const person = yield* services.person.create({ name: "Reader" })
      const unknown: Record<string, true> = { typo: true }
      const invalid = yield* services.person
        .list({
          filter: { field: "name", operator: "eq", value: "No matches" },
          expand: unknown,
        })
        .pipe(withApiErrors, Effect.flip)
      expect(invalid.status).toBe("INVALID_ARGUMENT")
      for (const size of [1, 1001]) {
        const result = yield* hydration
          .expand(
            [
              {
                ...person,
                links: {
                  accounts: {
                    ids: Array.from({ length: size }, (_, index) =>
                      RecordId("account")(`account_missing${index}`)
                    ),
                    totalSize: size,
                  },
                },
              },
            ],
            true
          )
          .pipe(withApiErrors, Effect.flip)
        expect(result.status).toBe("INVALID_ARGUMENT")
        expect(result).toMatchObject({
          details: {
            violations: [
              {
                message: expect.stringContaining(
                  size === 1 ? "unavailable" : "1000 distinct"
                ),
                reason: "INVALID_EXPANSION",
              },
            ],
          },
        })
      }
    })
)

fixture.test(
  "shares related audit fields and count validation across filters and sorts",
  () =>
    Effect.gen(function* () {
      const services = yield* implementation
      const account = yield* services.account.create({ name: "Audited" })
      yield* services.person.create({
        name: "Linked",
        links: { billingAccount: account.id, accounts: [account.id] },
      })
      yield* services.person.create({ name: "Unlinked" })
      expect(
        (yield* services.person.list({
          filter: {
            field: "billingAccount.createdAt",
            operator: "eq",
            value: account.createdAt,
          },
        })).totalSize
      ).toBe(1)
      expect(
        (yield* services.person.list({
          filter: { field: "accounts.$count", operator: "gt", value: 0 },
        })).totalSize
      ).toBe(1)
      const result = yield* Effect.exit(
        services.person.list({
          sort: [
            { field: "accounts.typo", aggregate: "count", direction: "asc" },
          ],
        })
      )
      expect(result._tag).toBe("Failure")
    })
)

fixture.test("attributes a record once per atomic relationship update", () =>
  Effect.gen(function* () {
    const services = yield* implementation
    const accounts = yield* Effect.forEach([1, 2, 3], (n) =>
      services.account.create({ name: `Shared ${n}` })
    )
    const person = yield* services.person.create({ name: "Batch" })
    const updated = yield* services.person.update({
      id: person.id,
      etag: person.etag,
      links: { accounts: accounts.map((record) => record.id) },
    })
    expect(BigInt(updated.etag)).toBe(BigInt(person.etag) + 1n)
    for (const account of accounts)
      expect(
        BigInt((yield* services.account.get({ id: account.id })).etag)
      ).toBe(BigInt(account.etag) + 1n)
  })
)

fixture.test("concurrent changes from opposite ends keep a single edge", () =>
  Effect.gen(function* () {
    const services = yield* implementation
    const account = yield* services.account.create({
      name: "Concurrent account",
    })
    const person = yield* services.person.create({ name: "Concurrent person" })
    yield* Effect.all(
      [
        services.person.update({
          id: person.id,
          links: { accounts: { add: [account.id] } },
        }),
        services.account.update({
          id: account.id,
          links: { people: { add: [person.id] } },
        }),
      ],
      { concurrency: 2 }
    )
    expect(
      (yield* services.person.get({ id: person.id })).links.accounts
    ).toEqual({ ids: [account.id], totalSize: 1 })
    expect(
      (yield* services.account.get({ id: account.id })).links.people
    ).toEqual({ ids: [person.id], totalSize: 1 })
  })
)
