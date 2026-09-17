import { Effect, type Layer } from "effect"
import { expect } from "vitest"

import { Model } from "#/app.model.ts"
import { demoScenario } from "#/app/seeds/demo.server.ts"
import { performanceScenario } from "#/app/seeds/performance.server.ts"
import {
  type makeApplicationServicesLayer,
  applicationOperations,
  runSeedScenario,
} from "#/app/server/application-services.ts"
import { Storage } from "#/app/server/database/schema.ts"
import { testApplication } from "#/app/server/test-application.ts"
import { ApplicationKeys } from "#/runtime/server/application-keys.ts"
import type { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { PageTokens } from "#/runtime/server/page-tokens.ts"
import {
  tableProjection,
  type TableRow,
  projection,
  type SelectionRow,
} from "#/runtime/server/storage/index.ts"
import {
  assetBlobs,
  eventJournal,
  seedRuns,
} from "#/runtime/server/storage/infrastructure.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"

const application = testApplication()
const { account: accounts, lead: leads } = Storage.objects

application.test(
  "seeds connected records and real assets once, preserves edits, and rolls back failures",
  () =>
    Effect.gen(function* () {
      const database = yield* SqlDatabase
      const sql = database.sql
      const infrastructure = {
        pageTokens: PageTokens.layerTest,
        applicationKeys: ApplicationKeys.layerTest,
      }
      expect(yield* runSeedScenario(demoScenario, infrastructure)).toBe(
        "seeded"
      )
      const blobs = yield* sql<
        TableRow<typeof assetBlobs>
      >`select ${tableProjection(assetBlobs)}
          from ${assetBlobs}`
      expect(blobs).toHaveLength(7)
      expect(blobs.every(({ bytes }) => bytes.byteLength > 100)).toBe(true)
      const [customer] = yield* sql<
        TableRow<typeof accounts>
      >`select ${tableProjection(accounts)}
          from ${accounts}
          where ${accounts.columns.name} = ${"Northstar Robotics"}`
      expect(customer?.logo).not.toBeNull()
      const originalEventsFields = { id: eventJournal.columns.id }
      const originalEvents = yield* sql<
        SelectionRow<typeof originalEventsFields>
      >`select ${projection(originalEventsFields)}
          from ${eventJournal}`
      const services = yield* applicationOperations
      expect((yield* services.connection.list({})).totalSize).toBe(0)
      expect((yield* services.githubRepository.list({})).totalSize).toBe(0)
      expect((yield* services.githubIssue.list({})).totalSize).toBe(0)
      expect((yield* services.githubPullRequest.list({})).totalSize).toBe(0)
      const record = (yield* services.account.list({
        filter: { field: "name", operator: "eq", value: "Northstar Robotics" },
      })).items[0]!
      yield* services.account.update({
        id: record.id,
        etag: record.etag,
        name: "Manually renamed",
      })
      const [contact] = (yield* services.lead.list({})).items
      yield* services.lead.delete({ id: contact!.id, etag: contact!.etag })
      const afterEditFields = { id: eventJournal.columns.id }
      const afterEdit = yield* sql<
        SelectionRow<typeof afterEditFields>
      >`select ${projection(afterEditFields)}
          from ${eventJournal}`
      expect(afterEdit.length).toBeGreaterThan(originalEvents.length)
      expect(yield* runSeedScenario(demoScenario, infrastructure)).toBe(
        "skipped"
      )
      expect(
        yield* sql<TableRow<typeof leads>>`select ${tableProjection(leads)}
          from ${leads}`
      ).toHaveLength(7)
      expect(
        (yield* sql<
          TableRow<typeof accounts>
        >`select ${tableProjection(accounts)}
          from ${accounts}
          where ${accounts.columns.id} = ${customer!.id}`)[0]!.name
      ).toBe("Manually renamed")
      expect(
        yield* sql<
          TableRow<typeof assetBlobs>
        >`select ${tableProjection(assetBlobs)}
          from ${assetBlobs}`
      ).toHaveLength(7)
      const selection = { id: eventJournal.columns.id }
      expect(
        yield* sql<
          SelectionRow<typeof selection>
        >`select ${projection(selection)}
          from ${eventJournal}`
      ).toHaveLength(afterEdit.length)
      const broken: {
        name: string
        parameters: Record<string, string | number>
        run: Effect.Effect<
          void,
          unknown,
          | Layer.Success<ReturnType<typeof makeApplicationServicesLayer>>
          | CurrentInvocation
        >
      } = {
        name: "broken",
        parameters: {},
        run: Effect.gen(function* () {
          yield* (yield* applicationOperations).account.create({
            name: "Must roll back",
          })
          return yield* Effect.fail(new Error("fixture failed"))
        }),
      }
      expect(
        (yield* Effect.result(runSeedScenario(broken, infrastructure)))._tag
      ).toBe("Failure")
      expect(
        yield* sql<
          TableRow<typeof accounts>
        >`select ${tableProjection(accounts)}
          from ${accounts}
          where ${accounts.columns.name} = ${"Must roll back"}`
      ).toHaveLength(0)
      expect(
        yield* sql<
          TableRow<typeof seedRuns>
        >`select ${tableProjection(seedRuns)}
          from ${seedRuns}
          where ${seedRuns.columns.name} = ${"broken"}`
      ).toHaveLength(0)
    })
)

application.test("supports a paginated, repeatable performance dataset", () =>
  Effect.gen(function* () {
    const infrastructure = {
      pageTokens: PageTokens.layerTest,
      applicationKeys: ApplicationKeys.layerTest,
    }
    yield* runSeedScenario(performanceScenario(60), infrastructure)
    expect(
      yield* runSeedScenario(performanceScenario(60), infrastructure)
    ).toBe("skipped")
    expect(
      (yield* Effect.result(
        runSeedScenario(performanceScenario(61), infrastructure)
      ))._tag
    ).toBe("Failure")
    const services = yield* applicationOperations
    expect((yield* services.connection.list({})).totalSize).toBe(0)
    expect((yield* services.githubRepository.list({})).totalSize).toBe(0)
    expect((yield* services.githubIssue.list({})).totalSize).toBe(0)
    expect((yield* services.githubPullRequest.list({})).totalSize).toBe(0)
    const first = yield* services.contact.list({ pageSize: 50 })
    expect(first.totalSize).toBe(60)
    expect(first.items).toHaveLength(50)
    expect(first.nextPageToken).toBeDefined()
    const second = yield* services.contact.list({
      pageSize: 50,
      pageToken: first.nextPageToken!,
    })
    expect(second.items).toHaveLength(10)
    expect(
      new Set([...first.items, ...second.items].map(({ id }) => id)).size
    ).toBe(60)
    expect((yield* services.lead.list({})).totalSize).toBe(60)
    expect((yield* services.note.list({})).totalSize).toBe(120)
    // Integration records come from real connections, never synthetic seed data.
    const sql = (yield* SqlDatabase).sql
    for (const module of Object.values(Model.modules)) {
      if (module.id === "platform" || module.id === "engineering") continue
      for (const object of module.objects) {
        const table = Storage.objects[object.id]
        const [row] = yield* sql<{
          count: number
        }>`select count(*)::int as count from ${table}`
        expect(row?.count, `${module.id}.${object.id}`).toBeGreaterThan(0)
      }
    }
    expect((yield* services.opportunity.list({})).totalSize).toBe(30)
    expect((yield* services.lineItem.list({})).totalSize).toBe(90)
    expect((yield* services.activity.list({})).totalSize).toBe(60)
    expect((yield* services.reply.list({})).totalSize).toBe(90)
    const tickets = (yield* services.ticket.list({ pageSize: 50 })).items
    expect(new Set(tickets.map((ticket) => ticket.status)).size).toBe(6)
    expect(tickets.some((ticket) => ticket.resolution !== null)).toBe(true)
    const ticketTable = Storage.objects.ticket
    const membershipContact = Storage.linkTables.affiliationContact
    const membershipAccount = Storage.linkTables.affiliationAccount
    const requester = Storage.linkTables.ticketRequester
    const account = Storage.linkTables.ticketAccount
    const [mismatch] = yield* sql<{
      count: number
    }>`select count(*)::int as count
      from ${ticketTable}
      join ${requester} on ${requester.columns.forwardId} = ${ticketTable.columns.id}
      join ${account} on ${account.columns.forwardId} = ${ticketTable.columns.id}
      where not exists (select 1 from ${membershipContact} join ${membershipAccount} on ${membershipAccount.columns.forwardId} = ${membershipContact.columns.forwardId} where ${membershipContact.columns.reverseId} = ${requester.columns.reverseId} and ${membershipAccount.columns.reverseId} = ${account.columns.reverseId})`
    expect(mismatch?.count).toBe(0)
  })
)
