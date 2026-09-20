import { Effect, Tracer } from "effect"
import { expect, expectTypeOf } from "vitest"

import { modelObjectLinkTraversals } from "#/runtime/model/index.ts"
import { Database } from "#/runtime/server/database.ts"
import { EventJournal } from "#/runtime/server/events/event-journal.ts"
import { operationsFor } from "#/runtime/server/operation-executor.ts"
import { Links } from "#/runtime/server/storage/link-store.ts"
import { Account, fixtureModel } from "#/runtime/testing/fixture-model.ts"
import { FixtureServer } from "#/runtime/testing/fixture-server.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const fixture = testFoundation(fixtureModel, { servers: [FixtureServer] })

function traceReads<A, E, R>(operation: Effect.Effect<A, E, R>) {
  return Effect.gen(function* () {
    const spans: Tracer.Span[] = []
    const tracer = Tracer.make({
      span(options) {
        const span = new Tracer.NativeSpan(options)
        spans.push(span)
        return span
      },
    })
    const result = yield* operation.pipe(
      Effect.provideService(Tracer.Tracer, tracer),
      Effect.withTracerEnabled(true)
    )
    const statements = spans.flatMap((span) => {
      const query = span.attributes.get("db.query.text")
      return typeof query === "string" ? [query] : []
    })
    return {
      result,
      fullReads: statements.filter((query) => query.includes('as "links"'))
        .length,
    }
  })
}

fixture.test(
  "assembles a standard mutation response and its journal snapshot with one full read",
  () =>
    Effect.gen(function* () {
      const services = yield* operationsFor(fixtureModel)
      const journal = yield* EventJournal
      const person = yield* services.person.create({ name: "Member" })
      const before = yield* journal.list({ cursor: "now" })
      const created = yield* traceReads(
        services.account.create({
          name: "Parent",
          links: { people: [person.id] },
        })
      )
      expect(created.fullReads).toBe(1)
      const page = yield* journal.list({ cursor: before.nextCursor })
      expect(
        page.items.find((event) => event.type === "account.created")?.data
      ).toEqual(created.result)
      expect(created.result.links.people.totalSize).toBe(1)
      const updated = yield* traceReads(
        services.account.update({
          id: created.result.id,
          name: "Changed",
          links: { people: [] },
        })
      )
      expect(updated.fullReads).toBe(1)
      const after = yield* journal.list({ cursor: page.nextCursor })
      expect(
        after.items.find((event) => event.type === "account.updated")?.data
      ).toEqual(updated.result)
      expect(updated.result.links.people.totalSize).toBe(0)
    })
)

fixture.test(
  "shares a final snapshot across repeated writes while preserving intermediate Action results",
  () =>
    Effect.gen(function* () {
      const services = yield* operationsFor(fixtureModel)
      const database = yield* Database
      const journal = yield* EventJournal
      const account = yield* services.account.create({ name: "Initial" })
      const before = yield* journal.list({ cursor: "now" })
      const measured = yield* traceReads(
        database.transaction(() =>
          Effect.gen(function* () {
            const first = yield* database
              .repository(Account)
              .update({ id: account.id, name: "First" })
            const second = yield* database
              .repository(Account)
              .update({ id: account.id, name: "Final" })
            expect(first.name).toBe("First")
            return second
          })
        )
      )
      // Two explicitly requested intermediate records, then one shared final snapshot.
      expect(measured.fullReads).toBe(3)
      const page = yield* journal.list({ cursor: before.nextCursor })
      const updates = page.items.filter(
        (event) => event.type === "account.updated"
      )
      expect(updates).toHaveLength(2)
      expect(updates.map((event) => event.data)).toEqual([
        measured.result,
        measured.result,
      ])
    })
)

fixture.test(
  "retains full snapshots for resources created and cascade-deleted in the same transaction",
  () =>
    Effect.gen(function* () {
      const services = yield* operationsFor(fixtureModel)
      const database = yield* Database
      const journal = yield* EventJournal
      const before = yield* journal.list({ cursor: "now" })
      const created = yield* database.transaction(() =>
        Effect.gen(function* () {
          const account = yield* services.account.create({ name: "Ephemeral" })
          const order = yield* services.order.create({
            name: "Owned",
            links: { account: account.id },
          })
          const line = yield* services.orderLine.create({
            name: "Child",
            links: { order: order.id },
          })
          yield* services.order.delete({ id: order.id })
          return { order, line }
        })
      )
      const page = yield* journal.list({ cursor: before.nextCursor })
      expect(
        page.items.find((event) => event.type === "orderLine.created")?.data
      ).toEqual(created.line)
      expect(
        page.items.find((event) => event.type === "order.created")?.data
      ).toMatchObject({
        id: created.order.id,
        links: { lines: { totalSize: 1, totalSizeExact: true } },
      })
      expect(page.items.map((event) => event.type)).toEqual(
        expect.arrayContaining(["order.deleted", "orderLine.deleted"])
      )
    })
)

fixture.test("keeps internal capabilities off the module repository", () =>
  Effect.gen(function* () {
    const database = yield* Database
    const repository = database.repository(Account)
    expectTypeOf<keyof typeof repository>().toEqualTypeOf<
      | "create"
      | "update"
      | "upsert"
      | "delete"
      | "batchDelete"
      | "get"
      | "batchGet"
      | "list"
    >()
    expect(repository).not.toHaveProperty("write")
    expect(repository).not.toHaveProperty("getStored")
    expect(repository).not.toHaveProperty("operations")
  })
)

fixture.test(
  "uses narrow reads for relationship sources and batch deletion",
  () =>
    Effect.gen(function* () {
      const services = yield* operationsFor(fixtureModel)
      const links = yield* Links
      const person = yield* services.person.create({ name: "Related" })
      const account = yield* services.account.create({
        name: "Source",
        links: { people: [person.id] },
      })
      const traversal = modelObjectLinkTraversals(fixtureModel, Account).find(
        ({ traversal: item }) => item.key === "people"
      )!
      const listed = yield* traceReads(
        links.list(traversal, { id: account.id })
      )
      expect(listed.result.items.map(({ id }) => id)).toEqual([person.id])
      // Only the requested related records need a full read shape.
      expect(listed.fullReads).toBe(1)
      const deleted = yield* traceReads(
        services.account.batchDelete({ ids: [account.id] })
      )
      expect(deleted.fullReads).toBe(0)
    })
)
