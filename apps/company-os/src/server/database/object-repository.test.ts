import { fileURLToPath } from "node:url"

import { AcmeModel } from "@acme/api"
import {
  DomainName,
  EmailAddress,
  Etag,
  RecordAlias,
  RecordId,
  Timestamp,
} from "@continual/runtime"
import {
  InvalidListRequest,
  RecordAliasConflict,
  RecordAliasNotFound,
  ObjectNotFound,
  ObjectParentTypeMismatch,
  ObjectWriteConflict,
} from "@continual/runtime/effect/object-repository"
import * as ObjectService from "@continual/runtime/effect/object-service"
import { PgliteClient } from "@effect/sql-pglite"
import { eq } from "drizzle-orm"
import * as PgliteDrizzle from "drizzle-orm/effect-pglite"
import { migrate } from "drizzle-orm/effect-pglite/migrator"
import { Effect } from "effect"
import { describe, expect, expectTypeOf, it } from "vitest"

import {
  PLATFORM_ID,
  SYSTEM_ACTOR_ID,
} from "@/server/authorization/well-known-authorization.server"
import { systemInvocation } from "@/server/invocation-context.server"
import { DealRepository } from "@/server/objects/deal-repository.server"
import { InteractionRepository } from "@/server/objects/interaction-repository.server"
import { LeadRepository } from "@/server/objects/lead-repository.server"
import { LineItemRepository } from "@/server/objects/line-item-repository.server"
import { seedCompanyOs } from "@/server/seeds/seed-company-os.server"

import { Database } from "./database.server"
import {
  makeRecordAliasResolver,
  makeObjectRepository,
  resolveRecordAlias,
} from "./model-storage.server"
import {
  lineItems,
  recordAliases,
  objects,
  parties,
  relations,
} from "./schema.server"

const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url))
const TestDatabase = PgliteClient.layer()
const CompanyId = RecordId("company")
const PlatformId = RecordId("platform")

function snakeCase(value: string): string {
  return value.replaceAll(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()
}

function asDatabase(
  database: Effect.Success<
    ReturnType<typeof PgliteDrizzle.makeWithDefaults<typeof relations>>
  >
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
  it("migrates and preserves object invariants across standard methods", async () => {
    let nextId = 0
    let nextInteractionId = 0
    const platform = PLATFORM_ID
    const context = systemInvocation
    const result = await run(
      Effect.gen(function* () {
        const database = yield* PgliteDrizzle.makeWithDefaults({ relations })
        yield* migrate(database, { migrationsFolder })
        yield* migrate(database, { migrationsFolder })

        const db = asDatabase(database)
        yield* seedCompanyOs().pipe(Effect.provideService(Database, db))
        const resolveTypedRecordAliases = yield* makeRecordAliasResolver.pipe(
          Effect.provideService(Database, db)
        )
        const repository = yield* makeObjectRepository(
          AcmeModel.objects.company
        ).pipe(Effect.provideService(Database, db))
        const service = ObjectService.make(
          AcmeModel.objects.company,
          repository,
          {
            authorize: () => Effect.void,
            generateEtag: () => `etag_${nextId}`,
            generateRecordId: () => `company_${++nextId}`,
            resolveRecordAliases: resolveTypedRecordAliases,
            visibleWithin: () => Effect.succeed([platform]),
          }
        )

        const hubspotAcme = RecordAlias("hubspot:portal_1:company:acme")
        const hubspotBravo = RecordAlias("hubspot:portal_1:company:bravo")
        const legacyAcme = RecordAlias("legacy:company:acme")
        const salesforceAcme = RecordAlias("salesforce:org_1:account:acme")
        const first = yield* service.create({
          aliases: [hubspotAcme],
          domain: DomainName("acme.example"),
          name: "Acme",
        })
        const second = yield* service.create({
          aliases: [hubspotBravo],
          name: "Bravo",
        })
        const updated = yield* service.update({
          id: first.id,
          name: "Acme Corporation",
        })
        const aliasDelta = yield* service.update({
          aliases: { add: [salesforceAcme], remove: [hubspotAcme] },
          id: first.id,
        })
        const aliasReplacement = yield* service.update({
          aliases: [legacyAcme],
          id: first.id,
        })
        const aliasConflict = yield* service
          .update({
            aliases: { add: [legacyAcme] },
            id: second.id,
          })
          .pipe(Effect.flip)
        const secondAfterConflict = yield* service.get({ id: second.id })
        const resolvedAlias = yield* resolveRecordAlias(legacyAcme).pipe(
          Effect.provideService(Database, db)
        )
        const foundByAlias = yield* service.get({ id: legacyAcme })
        const removedAlias = yield* resolveRecordAlias(hubspotAcme).pipe(
          Effect.flip,
          Effect.provideService(Database, db)
        )
        const batch = yield* service.batchGet({
          ids: [hubspotBravo, legacyAcme],
        })
        const clearedSecond = yield* service.update({
          aliases: [],
          id: second.id,
        })
        const clearedAlias = yield* resolveRecordAlias(hubspotBravo).pipe(
          Effect.flip,
          Effect.provideService(Database, db)
        )
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
        const filteredByAlias = yield* service.list({
          filter: { field: "id", operator: "eq", value: legacyAcme },
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
          .update({
            changes: { name: "Stale" },
            expectedEtag: first.etag,
            id: first.id,
            metadata: {
              etag: Etag("stale_etag"),
              updatedAt: updated.updatedAt,
              updatedBy: SYSTEM_ACTOR_ID,
            },
          })
          .pipe(Effect.flip)
        const wrongParent = yield* repository
          .insert({
            ...first,
            id: CompanyId("company_3"),
            parent: PlatformId(first.id),
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
            authorize: () => Effect.void,
            generateEtag: () => "lead_etag",
            generateRecordId: () => "lead_1",
            resolveRecordAliases: resolveTypedRecordAliases,
            visibleWithin: () => Effect.succeed([platform]),
          }
        )
        yield* leadService.create({
          companyName: "Acme",
          email: EmailAddress("Lead@Acme.Example"),
          name: "Ada",
        })
        const leads = yield* leadService.list({
          filter: {
            field: "email",
            operator: "eq",
            value: EmailAddress("Lead@Acme.Example"),
          },
        })
        const wrongTypeAlias = yield* leadService
          .get({ id: legacyAcme })
          .pipe(Effect.flip)

        const interactionRepository = yield* InteractionRepository.make.pipe(
          Effect.provideService(Database, db)
        )
        const interactionService = ObjectService.make(
          AcmeModel.objects.interaction,
          interactionRepository,
          {
            authorize: () => Effect.void,
            generateEtag: () => "interaction_etag",
            generateRecordId: () => `interaction_${++nextInteractionId}`,
            resolveRecordAliases: resolveTypedRecordAliases,
            visibleWithin: () => Effect.succeed([platform]),
          }
        )
        yield* interactionService.create({
          occurredAt: Timestamp("2026-08-20T12:00:00Z"),
          subject: legacyAcme,
          summary: "Introductory call",
        })
        yield* interactionService.create({
          occurredAt: Timestamp("2026-08-20T08:30:00-04:00"),
          subject: first.id,
          summary: "Follow-up call",
        })
        const partyInteractions = yield* interactionService.list({
          filter: {
            field: "subject",
            operator: "eq",
            value: legacyAcme,
          },
          sort: [{ direction: "desc", field: "occurredAt" }],
        })

        const dealRepository = yield* DealRepository.make.pipe(
          Effect.provideService(Database, db)
        )
        const dealService = ObjectService.make(
          AcmeModel.objects.deal,
          dealRepository,
          {
            authorize: () => Effect.void,
            generateEtag: () => "deal_etag",
            generateRecordId: () => "deal_1",
            resolveRecordAliases: resolveTypedRecordAliases,
            visibleWithin: () => Effect.succeed([platform]),
          }
        )
        const deal = yield* dealService.create({
          company: legacyAcme,
          name: "Expansion",
        })
        const dealsWithCompanies = yield* database.query.deal.findMany({
          with: { company: true },
        })
        type DealWithCompany = (typeof dealsWithCompanies)[number]
        expectTypeOf<DealWithCompany["company"]["id"]>().toEqualTypeOf<
          RecordId<"company">
        >()
        const lineItemRepository = yield* LineItemRepository.make.pipe(
          Effect.provideService(Database, db)
        )
        const lineItemService = ObjectService.make(
          AcmeModel.objects.lineItem,
          lineItemRepository,
          {
            authorize: () => Effect.void,
            generateEtag: () => "line_item_etag",
            generateRecordId: () => "line_item_1",
            resolveRecordAliases: resolveTypedRecordAliases,
            visibleWithin: () => Effect.succeed([platform]),
          }
        )
        const lineItem = yield* lineItemService.create({
          name: "Implementation",
          parent: deal.id,
        })
        const inconsistentParent = yield* database
          .update(objects)
          .set({ parentId: platform })
          .where(eq(objects.id, lineItem.id))
          .pipe(Effect.flip)
        const batchDeleteFailure = yield* service
          .batchDelete({ ids: [second.id, first.id] })
          .pipe(Effect.flip)
        const retainedAfterBatchDelete = yield* service.batchGet({
          ids: [second.id, first.id],
        })
        const lineItemKindRows = yield* database.select().from(lineItems)
        const lineItemObjectRows = yield* database.select().from(objects)
        const aliasRows = yield* database.select().from(recordAliases)
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
          aliasConflict,
          aliasDelta,
          aliasReplacement,
          aliasRows,
          batch,
          batchDeleteFailure,
          clearedAlias,
          clearedSecond,
          columns,
          dealsWithCompanies,
          first,
          firstPage,
          filteredByAlias,
          foundByAlias,
          filtered,
          inconsistentParent,
          invalidFilterValue,
          leads,
          lineItem,
          lineItemKindRows,
          lineItemObjectRows,
          mismatchedCursor,
          partyInteractions,
          partyRows,
          retainedAfterBatchDelete,
          removedAlias,
          resolvedAlias,
          rolledBack,
          second,
          secondAfterConflict,
          secondPage,
          sortedFirstPage,
          sortedSecondPage,
          staleWrite,
          updated,
          wrongParent,
          wrongTypeAlias,
        }
      }).pipe(Effect.provideService(ObjectService.CurrentInvocation, context))
    )

    expect(result.first).toMatchObject({
      aliases: ["hubspot:portal_1:company:acme"],
      domain: "acme.example",
      id: "company_1",
      lifecycleStage: "prospect",
      name: "Acme",
      parent: PLATFORM_ID,
    })
    expect(result.updated).toMatchObject({
      id: result.first.id,
      name: "Acme Corporation",
    })
    expect(result.aliasDelta.aliases).toEqual(["salesforce:org_1:account:acme"])
    expect(result.aliasReplacement.aliases).toEqual(["legacy:company:acme"])
    expect(result.aliasConflict).toBeInstanceOf(RecordAliasConflict)
    expect(result.secondAfterConflict.aliases).toEqual([
      "hubspot:portal_1:company:bravo",
    ])
    expect(result.resolvedAlias).toEqual({
      id: result.first.id,
      objectType: "company",
    })
    expect(result.foundByAlias.id).toBe(result.first.id)
    expect(result.removedAlias).toBeInstanceOf(RecordAliasNotFound)
    expect(result.clearedSecond.aliases).toEqual([])
    expect(result.clearedAlias).toBeInstanceOf(RecordAliasNotFound)
    expect(result.aliasRows).toEqual([
      { alias: "legacy:company:acme", objectId: result.first.id },
    ])
    expect(result.batch.items.map(({ id }) => id)).toEqual([
      result.second.id,
      result.first.id,
    ])
    expect(result.batchDeleteFailure).toBeDefined()
    expect(result.retainedAfterBatchDelete.items.map(({ id }) => id)).toEqual([
      result.second.id,
      result.first.id,
    ])
    expect(result.firstPage.items).toHaveLength(1)
    expect(result.firstPage.nextPageToken).not.toBe("")
    expect(result.secondPage.items).toHaveLength(1)
    expect(result.secondPage.nextPageToken).toBe("")
    expect(result.filtered.items.map(({ id }) => id)).toEqual([result.first.id])
    expect(result.filteredByAlias.items.map(({ id }) => id)).toEqual([
      result.first.id,
    ])
    expect(result.sortedFirstPage.items[0]?.name).toBe("Bravo")
    expect(result.sortedSecondPage.items[0]?.name).toBe("Acme Corporation")
    expect(result.mismatchedCursor).toBeInstanceOf(InvalidListRequest)
    expect(result.invalidFilterValue).toBeInstanceOf(InvalidListRequest)
    expect(result.staleWrite).toBeInstanceOf(ObjectWriteConflict)
    expect(result.wrongParent).toBeInstanceOf(ObjectParentTypeMismatch)
    expect(result.wrongTypeAlias).toBeInstanceOf(RecordAliasNotFound)
    expect(result.rolledBack).toBeInstanceOf(ObjectNotFound)
    expect(result.leads.items).toHaveLength(1)
    expect(result.leads.items[0]).toMatchObject({ email: "Lead@Acme.Example" })
    expect(result.partyRows.map(({ id }) => id)).toEqual([
      result.first.id,
      result.second.id,
    ])
    expect(result.partyInteractions.items).toEqual([
      expect.objectContaining({
        kind: "note",
        occurredAt: "2026-08-20T12:30:00.000Z",
        subject: result.first.id,
        summary: "Follow-up call",
      }),
      expect.objectContaining({
        kind: "note",
        occurredAt: "2026-08-20T12:00:00.000Z",
        subject: result.first.id,
        summary: "Introductory call",
      }),
    ])
    expect(result.inconsistentParent).toBeDefined()
    expect(result.lineItem).toMatchObject({
      name: "Implementation",
      parent: "deal_1",
      quantity: 1,
    })
    expect(result.dealsWithCompanies).toEqual([
      expect.objectContaining({
        company: expect.objectContaining({ id: result.first.id }),
        id: "deal_1",
      }),
    ])
    expect(result.lineItemKindRows).toEqual([
      expect.objectContaining({
        dealId: "deal_1",
        id: result.lineItem.id,
      }),
    ])
    expect(
      result.lineItemObjectRows.find(({ id }) => id === result.lineItem.id)
    ).toMatchObject({ ancestorIds: ["deal_1", PLATFORM_ID] })
    for (const object of Object.values(AcmeModel.objects)) {
      expect(
        new Set(
          result.columns
            .filter(
              ({ tableName }) => tableName === snakeCase(object.collection)
            )
            .map(({ columnName }) => columnName)
        )
      ).toEqual(
        new Set([
          "id",
          snakeCase(`${object.parent.typeId}Id`),
          ...Object.entries(object.properties).map(([propertyId, property]) =>
            snakeCase(
              property.kind === "recordId" ? `${propertyId}Id` : propertyId
            )
          ),
        ])
      )
    }
  })
})
