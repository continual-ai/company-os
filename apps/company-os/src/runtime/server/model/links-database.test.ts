import { Effect } from "effect"
import { expect } from "vitest"

import {
  defineLink,
  defineModel,
  defineModule,
  defineObject,
  modelObjectLinkTraversals,
  schema,
} from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { withApiErrors } from "#/runtime/server/api-error.ts"
import { modelImplementation } from "#/runtime/server/model/implementation.ts"
import { Links } from "#/runtime/server/model/link-service.ts"
import { ObjectRepositories } from "#/runtime/server/model/object-repositories.ts"
import { createRecordBatchGet } from "#/runtime/server/record-batch.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import { eventJournal } from "#/runtime/server/storage/infrastructure.ts"
import {
  FixtureModule,
  Person,
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
  from: Team,
  to: Person,
  forward: { key: "members", label: "Members", min: 1, max: 2 },
  reverse: { key: "teams", label: "Teams" },
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
      links: [Members],
    }),
  ],
})
const fixture = testFoundation(model, { servers: [FixtureServer] })
const implementation = modelImplementation(model)
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
      const { services } = yield* implementation
      const account = yield* services.account.create({ name: "Shared" })
      const people = yield* Effect.forEach([1, 2, 3, 4, 5], (n) =>
        services.person.create({
          name: `Person ${n}`,
          links: { accounts: [account.id] },
        })
      )
      const { sql } = yield* Database
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
  "enforces final bounds, explicit replacement, subset membership and protected links",
  () =>
    Effect.gen(function* () {
      const { services } = yield* implementation
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
        links: { members: { replace: [second.id] } },
      })
      expect(
        (yield* services.team.get({ id: team.id })).links.members?.ids
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
      expect(
        yield* withApiErrors(
          links.link(traversal(Person, "primaryAccount"), {
            id: first.id,
            target: account.id,
          })
        ).pipe(Effect.flip)
      ).toMatchObject({ status: "FAILED_PRECONDITION" })
      yield* services.person.update({
        id: first.id,
        links: {
          accounts: { add: [account.id] },
          primaryAccount: { replace: [account.id] },
        },
      })
      expect(
        yield* withApiErrors(
          links.unlink(traversal(Person, "accounts"), {
            id: first.id,
            target: account.id,
          })
        ).pipe(Effect.flip)
      ).toMatchObject({ status: "FAILED_PRECONDITION" })
      yield* services.person.update({
        id: first.id,
        links: {
          accounts: { remove: [account.id] },
          primaryAccount: { replace: [] },
        },
      })
      expect(
        (yield* services.person.get({ id: first.id })).links.accounts?.totalSize
      ).toBe(0)
    })
)

fixture.test(
  "cascades only explicitly owned records and validates survivors after deletion",
  () =>
    Effect.gen(function* () {
      const { services } = yield* implementation
      const account = yield* services.account.create({ name: "Owner" })
      const order = yield* services.order.create({
        name: "Purchase",
        links: { account: [account.id] },
      })
      const line = yield* services.orderLine.create({
        name: "Delivery",
        links: { order: [order.id] },
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
        (yield* services.account.get({ id: account.id })).links.orders
          ?.totalSize
      ).toBe(0)
    })
)

fixture.test("serializes competing additions without exceeding a maximum", () =>
  Effect.gen(function* () {
    const { services } = yield* implementation
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
      (yield* services.team.get({ id: team.id })).links.members?.totalSize
    ).toBe(2)
    // A transaction may replace a required edge by deleting then inserting it.
    const database = yield* Database
    yield* database.transaction(() =>
      Effect.gen(function* () {
        yield* services.team.update({
          id: team.id,
          links: { members: { replace: [people[0]!.id] } },
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
      (yield* (yield* ObjectRepositories).get(Team).get(team.id)).links.members
        ?.ids
    ).toEqual([people[1]!.id])
  })
)
