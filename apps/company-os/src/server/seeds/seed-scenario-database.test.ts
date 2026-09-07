import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { eq } from "drizzle-orm"
import { Effect, Layer } from "effect"
import { expect } from "vitest"

import { makeApplicationServicesLayer } from "@/server/application-services"
import { Database } from "@/server/database/database"
import { itDatabase } from "@/server/database/it-database"
import {
  assetBlobs,
  companies,
  leads,
  eventJournal,
  seedRuns,
} from "@/server/database/schema"
import { systemInvocation } from "@/server/invocation-context"
import { ModelImplementation } from "@/server/model/model-implementation"
import { PageTokens } from "@/server/page-tokens"

import { demoScenario } from "./demo-scenario"
import { performanceScenario } from "./performance-scenario"
import { runSeedScenario, type SeedScenario } from "./run-seed-scenario"
import { seedSystem } from "./seed-system"

itDatabase(
  "seeds connected records and real assets once, preserves edits, and rolls back failures",
  Effect.fn(function* () {
    const database = yield* Database
    yield* seedSystem().pipe(Effect.provide(PageTokens.layerTest))
    const infrastructure = { pageTokens: PageTokens.layerTest }
    expect(yield* runSeedScenario(demoScenario, infrastructure)).toBe("seeded")
    const blobs = yield* database.select().from(assetBlobs)
    expect(blobs).toHaveLength(7)
    expect(blobs.every(({ bytes }) => bytes.byteLength > 100)).toBe(true)
    const [customer] = yield* database
      .select()
      .from(companies)
      .where(eq(companies.name, "Northstar Robotics"))
    expect(customer?.logo).not.toBeNull()
    const originalEvents = yield* database
      .select({ id: eventJournal.id })
      .from(eventJournal)
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
    const afterEdit = yield* database
      .select({ id: eventJournal.id })
      .from(eventJournal)
    expect(afterEdit.length).toBeGreaterThan(originalEvents.length)
    expect(yield* runSeedScenario(demoScenario, infrastructure)).toBe("skipped")
    expect(yield* database.select().from(leads)).toHaveLength(7)
    expect(
      (yield* database
        .select()
        .from(companies)
        .where(eq(companies.id, customer!.id)))[0]!.name
    ).toBe("Manually renamed")
    expect(yield* database.select().from(assetBlobs)).toHaveLength(7)
    expect(
      yield* database.select({ id: eventJournal.id }).from(eventJournal)
    ).toHaveLength(afterEdit.length)
    const broken: SeedScenario = {
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
      yield* database
        .select()
        .from(companies)
        .where(eq(companies.name, "Must roll back"))
    ).toHaveLength(0)
    expect(
      yield* database.select().from(seedRuns).where(eq(seedRuns.name, "broken"))
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
