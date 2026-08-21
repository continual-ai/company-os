import { fileURLToPath } from "node:url"

import { AcmeModel } from "@acme/api"
import {
  ActorId,
  DomainName,
  EmailAddress,
  Etag,
  RecordId,
  Timestamp,
} from "@continual/runtime"
import {
  InvalidListRequest,
  ObjectNotFound,
  ObjectParentTypeMismatch,
  ObjectWriteConflict,
} from "@continual/runtime/effect/object-repository"
import * as ObjectService from "@continual/runtime/effect/object-service"
import { PgliteClient } from "@effect/sql-pglite"
import * as PgliteDrizzle from "drizzle-orm/effect-pglite"
import { migrate } from "drizzle-orm/effect-pglite/migrator"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import { InteractionRepository } from "@/server/objects/interaction-repository.server"
import { LeadRepository } from "@/server/objects/lead-repository.server"

import { Database } from "./drizzle.server"
import * as ObjectRepository from "./object-repository.server"
import { companies } from "./schema/companies"
import { objects } from "./schema/objects"
import { parties } from "./schema/parties"
import { roots } from "./schema/roots"

const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url))
const TestDatabase = PgliteClient.layer()
const CompanyId = RecordId("company")
const RootId = RecordId("root")

function snakeCase(value: string): string {
  return value.replaceAll(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()
}

function asDatabase(
  database: Effect.Success<ReturnType<typeof PgliteDrizzle.makeWithDefaults>>
): typeof Database.Service {
  // SAFETY: Drizzle's Effect PostgreSQL and PGlite drivers implement the same
  // query and transaction API. Tests replace only the underlying client.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
  return database as unknown as typeof Database.Service
}

function run<A, E>(effect: Effect.Effect<A, E, PgliteClient.PgliteClient>) {
  return Effect.runPromise(
    Effect.scoped(effect.pipe(Effect.provide(TestDatabase)))
  )
}

describe("Drizzle object repository", () => {
  it("migrates and preserves object invariants across standard and custom queries", async () => {
    let nextId = 0
    const result = await run(
      Effect.gen(function* () {
        const database = yield* PgliteDrizzle.makeWithDefaults()
        yield* migrate(database, { migrationsFolder })
        yield* migrate(database, { migrationsFolder })

        const root = RootId("root_1")
        yield* database.insert(objects).values({
          id: root,
          kind: "root",
          parentId: null,
          ancestorIds: [],
          annotations: {},
          etag: "root_etag",
          createdAt: "2026-08-20T00:00:00.000Z",
          createdById: "system",
          updatedAt: "2026-08-20T00:00:00.000Z",
          updatedById: "system",
        })
        yield* database.insert(roots).values({ id: root })

        const context = { actorId: ActorId("user_1"), rootId: root }
        const db = asDatabase(database)
        const repository = yield* ObjectRepository.make(
          AcmeModel.objects.company,
          companies,
          { interfaceTables: [parties] }
        ).pipe(Effect.provideService(Database, db))
        const service = ObjectService.make(
          AcmeModel.objects.company,
          repository,
          {
            authorize: () => Effect.succeed(context),
            generateEtag: () => `etag_${nextId}`,
            generateId: () => `company_${++nextId}`,
          }
        )

        const first = yield* service.create({
          domain: DomainName("acme.example"),
          name: "Acme",
        })
        const second = yield* service.create({ name: "Bravo" })
        const updated = yield* service.update({
          id: first.id,
          name: "Acme Corporation",
        })
        const batch = yield* service.batchGet({ ids: [second.id, first.id] })
        const firstPage = yield* service.list({ pageSize: 1 })
        if (firstPage.nextPageToken === "") {
          return yield* Effect.die("Expected another page")
        }
        const secondPage = yield* service.list({
          pageSize: 1,
          pageToken: firstPage.nextPageToken,
        })
        const filtered = yield* service.list({
          filter: { field: "name", operator: "contains", value: "acme" },
          sort: [{ direction: "asc", field: "name" }],
        })
        const sortedFirstPage = yield* service.list({
          pageSize: 1,
          sort: [{ direction: "desc", field: "name" }],
        })
        if (sortedFirstPage.nextPageToken === "") {
          return yield* Effect.die("Expected another sorted page")
        }
        const sortedSecondPage = yield* service.list({
          pageSize: 1,
          pageToken: sortedFirstPage.nextPageToken,
          sort: [{ direction: "desc", field: "name" }],
        })
        const mismatchedCursor = yield* service
          .list({
            pageSize: 1,
            pageToken: sortedFirstPage.nextPageToken,
            sort: [{ direction: "asc", field: "name" }],
          })
          .pipe(Effect.flip)
        const invalidFilter = {
          field: "name",
          operator: "eq",
          value: 42,
        } as const
        const invalidFilterValue = yield* service
          // @ts-expect-error Runtime input is validated even when it bypasses TypeScript.
          .list({ filter: invalidFilter })
          .pipe(Effect.flip)
        const staleWrite = yield* repository
          .update(first.id, { name: "Stale" }, first.etag, {
            etag: Etag("stale_etag"),
            updatedAt: updated.updatedAt,
            updatedById: context.actorId,
          })
          .pipe(Effect.flip)
        const wrongParent = yield* repository
          .insert({
            ...first,
            id: CompanyId("company_3"),
            parentId: RootId(first.id),
          })
          .pipe(Effect.flip)
        const rollbackId = CompanyId("company_rollback")
        yield* Database.transaction(
          repository
            .insert({
              ...second,
              etag: Etag("rollback_etag"),
              id: rollbackId,
            })
            .pipe(Effect.andThen(Effect.fail("rollback")))
        ).pipe(Effect.flip, Effect.provideService(Database, db))
        const rolledBack = yield* repository.get(rollbackId).pipe(Effect.flip)

        const leadRepository = yield* LeadRepository.make.pipe(
          Effect.provideService(Database, db)
        )
        const leadService = ObjectService.make(
          AcmeModel.objects.lead,
          leadRepository,
          {
            authorize: () => Effect.succeed(context),
            generateEtag: () => "lead_etag",
            generateId: () => "lead_1",
          }
        )
        yield* leadService.create({
          companyName: "Acme",
          email: EmailAddress("Lead@Acme.Example"),
          name: "Ada",
        })
        const leads = yield* leadRepository.findByEmail("lead@acme.example")

        const interactionRepository = yield* InteractionRepository.make.pipe(
          Effect.provideService(Database, db)
        )
        const interactionService = ObjectService.make(
          AcmeModel.objects.interaction,
          interactionRepository,
          {
            authorize: () => Effect.succeed(context),
            generateEtag: () => "interaction_etag",
            generateId: () => "interaction_1",
          }
        )
        yield* interactionService.create({
          occurredAt: Timestamp("2026-08-20T12:00:00Z"),
          subjectId: RecordId("party")(first.id),
          summary: "Introductory call",
        })
        const partyInteractions = yield* interactionService.list({
          filter: {
            field: "subjectId",
            operator: "eq",
            value: RecordId("party")(first.id),
          },
          sort: [{ direction: "desc", field: "occurredAt" }],
        })
        const partyRows = yield* database.select().from(parties)
        const columns = yield* database.$client<{
          columnName: string
          tableName: string
        }>`
          select
            column_name as "columnName",
            table_name as "tableName"
          from information_schema.columns
          where table_schema = 'public'
          order by table_name, column_name
        `

        return {
          batch,
          columns,
          first,
          firstPage,
          filtered,
          invalidFilterValue,
          leads,
          mismatchedCursor,
          partyInteractions,
          partyRows,
          rolledBack,
          second,
          secondPage,
          sortedFirstPage,
          sortedSecondPage,
          staleWrite,
          updated,
          wrongParent,
        }
      })
    )

    expect(result.first).toMatchObject({
      domain: "acme.example",
      id: "company_1",
      lifecycleStage: "prospect",
      name: "Acme",
      parentId: "root_1",
    })
    expect(result.updated).toMatchObject({
      id: result.first.id,
      name: "Acme Corporation",
    })
    expect(result.batch.items.map(({ id }) => id)).toEqual([
      result.second.id,
      result.first.id,
    ])
    expect(result.firstPage.items).toHaveLength(1)
    expect(result.firstPage.nextPageToken).not.toBe("")
    expect(result.secondPage.items).toHaveLength(1)
    expect(result.secondPage.nextPageToken).toBe("")
    expect(result.filtered.items.map(({ id }) => id)).toEqual([result.first.id])
    expect(result.sortedFirstPage.items[0]?.name).toBe("Bravo")
    expect(result.sortedSecondPage.items[0]?.name).toBe("Acme Corporation")
    expect(result.mismatchedCursor).toBeInstanceOf(InvalidListRequest)
    expect(result.invalidFilterValue).toBeInstanceOf(InvalidListRequest)
    expect(result.staleWrite).toBeInstanceOf(ObjectWriteConflict)
    expect(result.wrongParent).toBeInstanceOf(ObjectParentTypeMismatch)
    expect(result.rolledBack).toBeInstanceOf(ObjectNotFound)
    expect(result.leads).toHaveLength(1)
    expect(result.leads[0]).toMatchObject({ email: "Lead@Acme.Example" })
    expect(result.partyRows.map(({ id }) => id)).toEqual([
      result.first.id,
      result.second.id,
    ])
    expect(result.partyInteractions.items).toEqual([
      expect.objectContaining({
        kind: "note",
        subjectId: result.first.id,
        summary: "Introductory call",
      }),
    ])
    for (const object of Object.values(AcmeModel.objects)) {
      expect(
        new Set(
          result.columns
            .filter(({ tableName }) => tableName === object.collection)
            .map(({ columnName }) => columnName)
        )
      ).toEqual(
        new Set(["id", ...Object.keys(object.properties).map(snakeCase)])
      )
    }
  })
})
