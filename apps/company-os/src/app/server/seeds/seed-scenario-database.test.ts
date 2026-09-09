import { Effect, Layer } from "effect"
import { expect } from "vitest"

import { demoScenario } from "#/app/seeds/demo.server.ts"
import { performanceScenario } from "#/app/seeds/performance.server.ts"
import { makeApplicationServicesLayer } from "#/app/server/application-services.ts"
import { ModelImplementation } from "#/app/server/application-services.ts"
import { runSeedScenario } from "#/app/server/application-services.ts"
import { itDatabase } from "#/app/server/database/it-database.ts"
import { companies, leads } from "#/app/server/database/schema.ts"
import { seedSystem } from "#/app/server/seeds/seed-system.ts"
import { Database } from "#/runtime/server/database/database.ts"
import {
  assetBlobs,
  eventJournal,
  seedRuns,
} from "#/runtime/server/database/schema.ts"
import { systemInvocation } from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { PageTokens } from "#/runtime/server/page-tokens.ts"
import {
  tableProjection,
  type TableRow,
  projection,
  type SelectionRow,
} from "#/runtime/server/postgres/index.ts"

itDatabase(
  "seeds connected records and real assets once, preserves edits, and rolls back failures",
  Effect.fn(function* () {
    const database = yield* Database
    const sql = database.sql
    yield* seedSystem().pipe(Effect.provide(PageTokens.layerTest))
    const infrastructure = { pageTokens: PageTokens.layerTest }
    expect(yield* runSeedScenario(demoScenario, infrastructure)).toBe("seeded")
    const blobs = yield* sql<
      TableRow<typeof assetBlobs>
    >`select ${tableProjection(assetBlobs)}
          from ${assetBlobs}`
    expect(blobs).toHaveLength(7)
    expect(blobs.every(({ bytes }) => bytes.byteLength > 100)).toBe(true)
    const [customer] = yield* sql<
      TableRow<typeof companies>
    >`select ${tableProjection(companies)}
          from ${companies}
          where ${companies.columns.name} = ${"Northstar Robotics"}`
    expect(customer?.logo).not.toBeNull()
    const originalEventsFields = { id: eventJournal.columns.id }
    const originalEvents = yield* sql<
      SelectionRow<typeof originalEventsFields>
    >`select ${projection(originalEventsFields)}
          from ${eventJournal}`
    yield* Effect.gen(function* () {
      const { services } = yield* ModelImplementation
      const record = (yield* services.company.list({
        filter: { field: "name", operator: "eq", value: "Northstar Robotics" },
      })).items[0]!
      yield* services.company.update({
        id: record.id,
        etag: record.etag,
        name: "Manually renamed",
      })
      const [contact] = (yield* services.lead.list({})).items
      yield* services.lead.delete({ id: contact!.id, etag: contact!.etag })
    }).pipe(
      Effect.provide(
        makeApplicationServicesLayer({
          database: Layer.succeed(Database, database),
          ...infrastructure,
        })
      ),
      Effect.provideService(CurrentInvocation, systemInvocation)
    )
    const afterEditFields = { id: eventJournal.columns.id }
    const afterEdit = yield* sql<
      SelectionRow<typeof afterEditFields>
    >`select ${projection(afterEditFields)}
          from ${eventJournal}`
    expect(afterEdit.length).toBeGreaterThan(originalEvents.length)
    expect(yield* runSeedScenario(demoScenario, infrastructure)).toBe("skipped")
    expect(
      yield* sql<TableRow<typeof leads>>`select ${tableProjection(leads)}
          from ${leads}`
    ).toHaveLength(7)
    expect(
      (yield* sql<
        TableRow<typeof companies>
      >`select ${tableProjection(companies)}
          from ${companies}
          where ${companies.columns.id} = ${customer!.id}`)[0]!.name
    ).toBe("Manually renamed")
    expect(
      yield* sql<
        TableRow<typeof assetBlobs>
      >`select ${tableProjection(assetBlobs)}
          from ${assetBlobs}`
    ).toHaveLength(7)
    const selection = { id: eventJournal.columns.id }
    expect(
      yield* sql<SelectionRow<typeof selection>>`select ${projection(selection)}
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
        yield* (yield* ModelImplementation).services.company.create({
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
        TableRow<typeof companies>
      >`select ${tableProjection(companies)}
          from ${companies}
          where ${companies.columns.name} = ${"Must roll back"}`
    ).toHaveLength(0)
    expect(
      yield* sql<TableRow<typeof seedRuns>>`select ${tableProjection(seedRuns)}
          from ${seedRuns}
          where ${seedRuns.columns.name} = ${"broken"}`
    ).toHaveLength(0)
  })
)

itDatabase(
  "supports a paginated, repeatable performance dataset",
  Effect.fn(function* () {
    const database = yield* Database
    yield* seedSystem().pipe(Effect.provide(PageTokens.layerTest))
    const infrastructure = { pageTokens: PageTokens.layerTest }
    yield* runSeedScenario(performanceScenario(60), infrastructure)
    expect(
      yield* runSeedScenario(performanceScenario(60), infrastructure)
    ).toBe("skipped")
    expect(
      (yield* Effect.result(
        runSeedScenario(performanceScenario(61), infrastructure)
      ))._tag
    ).toBe("Failure")
    yield* Effect.gen(function* () {
      const { services } = yield* ModelImplementation
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
      expect((yield* services.note.list({})).totalSize).toBe(60)
    }).pipe(
      Effect.provide(
        makeApplicationServicesLayer({
          database: Layer.succeed(Database, database),
          ...infrastructure,
        })
      ),
      Effect.provideService(CurrentInvocation, systemInvocation)
    )
  })
)
