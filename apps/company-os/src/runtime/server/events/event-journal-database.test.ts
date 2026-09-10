import { Deferred, Effect, Fiber } from "effect"
import { expect } from "vitest"

import { modelObjectLinkTraversals } from "#/runtime/model/index.ts"
import { EventJournal } from "#/runtime/server/events/event-journal.ts"
import { flushEvents } from "#/runtime/server/events/flush-events.ts"
import { systemInvocation } from "#/runtime/server/invocation-context.ts"
import { modelImplementation } from "#/runtime/server/model/implementation.ts"
import { Links } from "#/runtime/server/model/link-service.ts"
import { CommittedChanges } from "#/runtime/server/storage/committed-changes.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import {
  assignments,
  tableProjection,
  type TableRow,
} from "#/runtime/server/storage/index.ts"
import {
  eventJournal,
  eventJournalState,
} from "#/runtime/server/storage/infrastructure.ts"
import {
  Account,
  fixtureModel,
  Person,
  ProspectConverted,
} from "#/runtime/testing/fixture-model.ts"
import { FixtureServer } from "#/runtime/testing/fixture-server.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const fixture = testFoundation(fixtureModel, { servers: [FixtureServer] })
const implementation = modelImplementation(fixtureModel)
const linkTraversal = (object: typeof Account | typeof Person, key: string) =>
  modelObjectLinkTraversals(fixtureModel, object).find(
    (candidate) => candidate.traversal.key === key
  )!

fixture.test(
  "records business writes, semantic events, joined transactions, and Link cascades atomically",
  () =>
    Effect.gen(function* () {
      const database = yield* Database
      const journal = yield* EventJournal
      const { services } = yield* implementation
      const start = yield* journal.list({ cursor: "now" })
      const changes = new Set<string>()
      yield* database
        .transaction(() =>
          services.account
            .create({ name: "Rolled back" })
            .pipe(Effect.andThen(Effect.fail("rollback")))
        )
        .pipe(
          Effect.provideService(CommittedChanges, changes),
          Effect.catch(() => Effect.void)
        )
      expect([...changes]).toEqual([])
      expect((yield* journal.list({ cursor: start.nextCursor })).items).toEqual(
        []
      )

      // Nested calls join the open transaction: a caught nested failure keeps
      // its writes and events, and everything commits or rolls back together.
      yield* database
        .transaction(() =>
          Effect.gen(function* () {
            yield* services.account.create({ name: "Kept" })
            expect([...changes]).toEqual([])
            yield* database
              .transaction((tx) =>
                tx.transaction(() =>
                  services.person
                    .create({ name: "Joined" })
                    .pipe(Effect.andThen(Effect.fail("nested failure")))
                )
              )
              .pipe(Effect.catch(() => Effect.void))
          })
        )
        .pipe(Effect.provideService(CommittedChanges, changes))
      expect([...changes].sort()).toEqual(["account", "person"])
      expect(
        (yield* services.account.list({})).items.map((item) => item.name)
      ).toEqual(["Kept"])
      expect(
        (yield* services.person.list({})).items.map((item) => item.name)
      ).toEqual(["Joined"])
      expect(
        (yield* journal.list({ cursor: start.nextCursor })).items.map(
          (item) => item.type
        )
      ).toEqual(["account.created", "person.created"])

      const prospect = yield* services.prospect.create({
        name: "Ada",
        accountName: "Engine",
      })
      const before = yield* journal.list({ cursor: "now" })
      const converted = yield* services.prospect.convert({ id: prospect.id })
      yield* services.prospect.convert({ id: prospect.id })
      const page = yield* journal.list({ cursor: before.nextCursor })
      expect(
        page.items.filter((event) => event.type === "prospect.converted")
      ).toMatchObject([{ data: converted, actorId: systemInvocation.actorId }])
      expect(new Set(page.items.map((event) => event.transactionId)).size).toBe(
        1
      )
      expect(page.items.map((event) => event.type)).toEqual(
        expect.arrayContaining([
          "account.created",
          "person.created",
          "prospect.updated",
          "personAccounts.linked",
          "personPrimaryAccount.linked",
          "prospect.converted",
        ])
      )
      expect((yield* journal.list({ cursor: page.nextCursor })).items).toEqual(
        []
      )

      const standalone = yield* services.account.create({
        name: "Disposable",
      })
      const member = yield* services.person.create({ name: "Member" })
      const links = yield* Links
      yield* links.link(linkTraversal(Person, "primaryAccount"), {
        id: member.id,
        target: standalone.id,
      })
      const checkpoint = yield* journal.list({ cursor: "now" })
      yield* links.link(linkTraversal(Account, "people"), {
        id: standalone.id,
        target: member.id,
      })
      expect(
        (yield* journal.list({ cursor: checkpoint.nextCursor })).items
      ).toEqual([])
      yield* services.account.delete({ id: standalone.id })
      expect(
        (yield* journal.list({ cursor: checkpoint.nextCursor })).items
          .map((event) => event.type)
          .sort()
      ).toEqual([
        "account.deleted",
        "personAccounts.unlinked",
        "personPrimaryAccount.unlinked",
      ])
    })
)

fixture.test(
  "never skips a transaction that began earlier but commits later",
  () =>
    Effect.gen(function* () {
      const database = yield* Database
      const sql = database.sql
      const journal = yield* EventJournal
      const { services } = yield* implementation
      const start = yield* journal.list({ cursor: "now" })
      const staged = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const slow = yield* Effect.forkChild(
        database.transaction(() =>
          Effect.gen(function* () {
            const record = yield* services.account.create({
              name: "Commits second",
            })
            yield* Deferred.succeed(staged, undefined)
            yield* Deferred.await(release)
            return record
          })
        )
      )
      yield* Deferred.await(staged)
      const fast = yield* services.account.create({ name: "Commits first" })
      const firstPage = yield* journal.list({ cursor: start.nextCursor })
      expect(firstPage.items.map((event) => event.subjects[0]?.id)).toEqual([
        fast.id,
      ])
      yield* Deferred.succeed(release, undefined)
      const late = yield* Fiber.join(slow)
      expect(
        (yield* journal.list({ cursor: firstPage.nextCursor })).items.map(
          (event) => event.subjects[0]?.id
        )
      ).toEqual([late.id])
      const rows = yield* sql<
        TableRow<typeof eventJournal>
      >`select ${tableProjection(eventJournal)}
          from ${eventJournal}
          order by ${sql.csv([eventJournal.columns.position])}`
      const [state] = yield* sql<
        TableRow<typeof eventJournalState>
      >`select ${tableProjection(eventJournalState)}
          from ${eventJournalState}`
      expect(rows.at(-1)?.position).toBe(state?.position)
    })
)

fixture.test(
  "rejects append outside a transaction instead of producing a non-atomic event",
  () =>
    Effect.gen(function* () {
      const journal = yield* EventJournal
      const { services } = yield* implementation
      const prospect = yield* services.prospect.create({
        name: "Ada",
        accountName: "Engine",
      })
      const converted = yield* services.prospect.convert({ id: prospect.id })
      const before = yield* journal.list({ cursor: "now" })
      const result = yield* journal
        .append(ProspectConverted, {
          subject: prospect.id,
          data: converted,
        })
        .pipe(Effect.exit)
      expect(result._tag).toBe("Failure")
      expect(
        (yield* journal.list({ cursor: before.nextCursor })).items
      ).toEqual([])
    })
)

fixture.test(
  "rolls back business writes when journal persistence fails and forbids rewriting history",
  () =>
    Effect.gen(function* () {
      const database = yield* Database
      const sql = database.sql
      const journal = yield* EventJournal
      const { services } = yield* implementation
      yield* services.account.create({ name: "Committed" })
      const before = yield* journal.list({ cursor: "now" })
      // Force a journal primary-key collision at flush, after the business INSERT succeeds.
      const changes = new Set<string>()
      const failed = yield* database
        .transaction(() =>
          Effect.gen(function* () {
            yield* sql`update ${eventJournalState} set ${assignments(sql, eventJournalState, { position: 0n })}
          where ${eventJournalState.columns.id} = ${1}`
            yield* services.account.create({ name: "Must roll back" })
          })
        )
        .pipe(Effect.provideService(CommittedChanges, changes), Effect.exit)
      expect([...changes]).toEqual([])
      expect(failed._tag).toBe("Failure")
      expect(
        (yield* services.account.list({})).items.map((item) => item.name)
      ).toEqual(["Committed"])
      expect(
        (yield* journal.list({ cursor: before.nextCursor })).items
      ).toEqual([])
      expect(
        (yield* sql`update ${eventJournal} set ${assignments(sql, eventJournal, { actorId: "forged" })}`.pipe(
          Effect.exit
        ))._tag
      ).toBe("Failure")
      expect(
        (yield* sql`delete
          from ${eventJournal}`.pipe(Effect.exit))._tag
      ).toBe("Failure")
    })
)

fixture.test(
  "replays stored JSON after its original model shape has changed",
  () =>
    Effect.gen(function* () {
      const database = yield* Database
      const sql = database.sql
      const journal = yield* EventJournal
      const { services } = yield* implementation
      const start = yield* journal.list({ cursor: "now" })
      const person = yield* services.person.create({
        name: "Historical person",
      })
      const original = (yield* journal.list({ cursor: start.nextCursor }))
        .items[0]!
      const historical = {
        id: person.id,
        etag: person.etag,
        oldName: "Preserved history",
      }
      const [stored] = yield* sql<
        TableRow<typeof eventJournal>
      >`select ${tableProjection(eventJournal)}
          from ${eventJournal}
          where ${eventJournal.columns.id} = ${original.id}`
      if (stored === undefined) throw new Error("Missing committed event")
      // Seed an old format below today's writer decoder without rewriting history.
      yield* database.transaction((tx) =>
        flushEvents(tx, [{ ...stored, id: "ev_historical", data: historical }])
      )
      const replay = yield* journal.list({ cursor: start.nextCursor })
      expect(
        replay.items.find((event) => event.id === "ev_historical")?.data
      ).toEqual(historical)
      expect((yield* services.person.get({ id: person.id })).name).toBe(
        "Historical person"
      )
    })
)
