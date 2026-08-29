import { fileURLToPath } from "node:url"

import { Model } from "@company/model"
import {
  DomainName,
  EmailAddress,
  PageToken,
  RecordAlias,
  RecordId,
} from "@company/runtime"
import {
  InvalidListRequest,
  RecordAliasConflict,
  RecordAliasNotFound,
  ObjectNotFound,
  ObjectParentTypeMismatch,
  ObjectWriteConflict,
} from "@company/runtime/effect/object-repository"
import * as ObjectService from "@company/runtime/effect/object-service"
import { PgliteClient } from "@effect/sql-pglite"
import { eq } from "drizzle-orm"
import * as PgliteDrizzle from "drizzle-orm/effect-pglite"
import { migrate } from "drizzle-orm/effect-pglite/migrator"
import { Effect, Layer } from "effect"
import { describe, expect, expectTypeOf, it } from "vitest"

import { systemInvocation } from "@/server/invocation-context"
import { RecordIdentifierResolver } from "@/server/model/record-identifier-resolver"
import { PageTokens } from "@/server/page-tokens"
import { seedSystem } from "@/server/seeds/seed-system"
import { ROOT_ID, SYSTEM_SERVICE_ACCOUNT_ID } from "@/system-records"

import { Database } from "./database"
import { makeObjectRepository } from "./object-repository"
import { lineItems, recordAliases, objects, parties, relations } from "./schema"
import { asTestDatabase } from "./test-database"

const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url))
const TestDatabase = PgliteClient.layer()
const CompanyId = RecordId("company")

function omitStorageFields<
  TRecord extends {
    readonly createdAt: unknown
    readonly etag: unknown
    readonly updatedAt: unknown
  },
>(record: TRecord): Omit<TRecord, "createdAt" | "etag" | "updatedAt"> {
  const {
    createdAt: _createdAt,
    etag: _etag,
    updatedAt: _updatedAt,
    ...insert
  } = record
  return insert
}
const RootId = RecordId("root")

function snakeCase(value: string): string {
  return value.replaceAll(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()
}

function run<A, E>(
  effect: Effect.Effect<A, E, PageTokens | PgliteClient.PgliteClient>
) {
  return Effect.runPromise(
    Effect.scoped(
      effect.pipe(
        Effect.provide(Layer.merge(TestDatabase, PageTokens.layerTest))
      )
    )
  )
}

describe("Drizzle object repository", () => {
  it("migrates and preserves object invariants across standard methods", async () => {
    let nextId = 0
    const root = ROOT_ID
    const context = systemInvocation
    const result = await run(
      Effect.gen(function* () {
        const database = yield* PgliteDrizzle.makeWithDefaults({ relations })
        yield* migrate(database, { migrationsFolder })
        yield* migrate(database, { migrationsFolder })

        const db = asTestDatabase(database)
        yield* seedSystem().pipe(Effect.provideService(Database, db))
        const identifiers = yield* RecordIdentifierResolver.make.pipe(
          Effect.provideService(Database, db)
        )
        const repository = yield* makeObjectRepository(
          Model.objects.company
        ).pipe(Effect.provideService(Database, db))
        const service = ObjectService.make(Model.objects.company, repository, {
          authorize: () => Effect.void,
          generateRecordId: () => `company_${++nextId}`,
          rootId: root,
          resolveRecordAliases: identifiers.resolveAliases,
          visibleWithin: () => Effect.succeed([root]),
        })

        const hubspotExample = RecordAlias("hubspot:portal_1:company:example")
        const hubspotBravo = RecordAlias("hubspot:portal_1:company:bravo")
        const legacyExample = RecordAlias("legacy:company:example")
        const salesforceExample = RecordAlias(
          "salesforce:org_1:account:example"
        )
        const first = yield* service.create({
          aliases: [hubspotExample],
          domain: DomainName("example.example"),
          name: "Example",
        })
        const second = yield* service.create({
          aliases: [hubspotBravo],
          name: "Bravo",
        })
        const updated = yield* service.update({
          id: first.id,
          name: "Example Corporation",
        })
        const aliasDelta = yield* service.update({
          aliases: { add: [salesforceExample], remove: [hubspotExample] },
          id: first.id,
        })
        const aliasReplacement = yield* service.update({
          aliases: [legacyExample],
          id: first.id,
        })
        const aliasConflict = yield* service
          .update({
            aliases: { add: [legacyExample] },
            id: second.id,
          })
          .pipe(Effect.flip)
        const secondAfterConflict = yield* service.get({ id: second.id })
        const resolvedAlias = yield* identifiers.resolve(
          "company",
          legacyExample
        )
        const foundByAlias = yield* service.get({ id: legacyExample })
        const removedAlias = yield* identifiers
          .resolve("company", hubspotExample)
          .pipe(Effect.flip)
        const batch = yield* service.batchGet({
          ids: [hubspotBravo, legacyExample],
        })
        const clearedSecond = yield* service.update({
          aliases: [],
          id: second.id,
        })
        const clearedAlias = yield* identifiers
          .resolve("company", hubspotBravo)
          .pipe(Effect.flip)
        const firstPage = yield* service.list({ pageSize: 1 })
        if (firstPage.nextPageToken === null) {
          return yield* Effect.die("Expected another page")
        }
        const secondPage = yield* service.list({
          pageSize: 1,
          pageToken: firstPage.nextPageToken,
        })
        const zeroPageSize = yield* service.list({ pageSize: 0 })
        const oversizedPage = yield* service.list({ pageSize: 10_000 })
        const tamperedCursor = yield* service
          .list({
            pageSize: 1,
            pageToken: PageToken(
              `${firstPage.nextPageToken.startsWith("A") ? "B" : "A"}${firstPage.nextPageToken.slice(1)}`
            ),
          })
          .pipe(Effect.flip)
        const filtered = yield* service.list({
          filter: { field: "name", operator: "contains", value: "example" },
          sort: [{ direction: "asc", field: "name" }],
        })
        const filteredByAlias = yield* service.list({
          filter: { field: "id", operator: "eq", value: legacyExample },
        })
        const sortedFirstPage = yield* service.list({
          pageSize: 1,
          sort: [{ direction: "desc", field: "name" }],
        })
        if (sortedFirstPage.nextPageToken === null) {
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
            etag: first.etag,
            id: first.id,
            name: "Stale",
            updatedBy: SYSTEM_SERVICE_ACCOUNT_ID,
          })
          .pipe(Effect.flip)
        const wrongParent = yield* repository
          .insert({
            ...omitStorageFields(first),
            id: CompanyId("company_3"),
            parent: RootId(first.id),
          })
          .pipe(Effect.flip)
        const userRepository = yield* makeObjectRepository(
          Model.objects.user
        ).pipe(Effect.provideService(Database, db))
        const userRecord = {
          aliases: [],
          createdBy: SYSTEM_SERVICE_ACCOUNT_ID,
          email: EmailAddress("unique@example.example"),
          image: null,
          metadata: {},
          name: "First User",
          parent: root,
          status: "active" as const,
          systemManaged: false,
          updatedBy: SYSTEM_SERVICE_ACCOUNT_ID,
        }
        yield* userRepository.insert({
          ...userRecord,
          id: RecordId("user")("user_unique_1"),
        })
        const userWithSharedEmail = yield* userRepository.insert({
          ...userRecord,
          id: RecordId("user")("user_unique_2"),
          name: "Second User",
        })
        const rollbackId = CompanyId("company_rollback")
        yield* db
          .transaction(() =>
            repository
              .insert({
                ...omitStorageFields(second),
                id: rollbackId,
              })
              .pipe(Effect.andThen(Effect.fail("rollback")))
          )
          .pipe(Effect.flip)
        const rolledBack = yield* repository.get(rollbackId).pipe(Effect.flip)

        const leadRepository = yield* makeObjectRepository(
          Model.objects.lead
        ).pipe(Effect.provideService(Database, db))
        const leadService = ObjectService.make(
          Model.objects.lead,
          leadRepository,
          {
            authorize: () => Effect.void,
            generateRecordId: () => "lead_1",
            rootId: root,
            resolveRecordAliases: identifiers.resolveAliases,
            visibleWithin: () => Effect.succeed([root]),
          }
        )
        yield* leadService.create({
          companyName: "Example",
          email: EmailAddress("Lead@Example.Example"),
          name: "Ada",
        })
        const leads = yield* leadService.list({
          filter: {
            field: "email",
            operator: "eq",
            value: EmailAddress("Lead@Example.Example"),
          },
        })
        const wrongTypeAlias = yield* leadService
          .get({ id: legacyExample })
          .pipe(Effect.flip)

        const dealRepository = yield* makeObjectRepository(
          Model.objects.deal
        ).pipe(Effect.provideService(Database, db))
        const dealService = ObjectService.make(
          Model.objects.deal,
          dealRepository,
          {
            authorize: () => Effect.void,
            generateRecordId: () => "deal_1",
            rootId: root,
            resolveRecordAliases: identifiers.resolveAliases,
            visibleWithin: () => Effect.succeed([root]),
          }
        )
        const deal = yield* dealService.create({
          name: "Expansion",
          parent: legacyExample,
        })
        const storedDeals = yield* database.query.deal.findMany()
        type StoredDeal = (typeof storedDeals)[number]
        expectTypeOf<StoredDeal["parentId"]>().toEqualTypeOf<
          RecordId<"company">
        >()
        const lineItemRepository = yield* makeObjectRepository(
          Model.objects.lineItem
        ).pipe(Effect.provideService(Database, db))
        const lineItemService = ObjectService.make(
          Model.objects.lineItem,
          lineItemRepository,
          {
            authorize: () => Effect.void,
            generateRecordId: () => "line_item_1",
            rootId: root,
            resolveRecordAliases: identifiers.resolveAliases,
            visibleWithin: () => Effect.succeed([root]),
          }
        )
        const lineItem = yield* lineItemService.create({
          name: "Implementation",
          parent: deal.id,
        })
        const inconsistentParent = yield* database
          .update(objects)
          .set({ parentId: root })
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
          storedDeals,
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
          tamperedCursor,
          updated,
          userWithSharedEmail,
          wrongParent,
          wrongTypeAlias,
          zeroPageSize,
          oversizedPage,
        }
      }).pipe(Effect.provideService(ObjectService.CurrentInvocation, context))
    )

    expect(result.first).toMatchObject({
      aliases: ["hubspot:portal_1:company:example"],
      domain: "example.example",
      id: "company_1",
      lifecycleStage: "prospect",
      name: "Example",
      parent: ROOT_ID,
    })
    expect(result.updated).toMatchObject({
      id: result.first.id,
      name: "Example Corporation",
    })
    expect(result.updated.createdAt).toBe(result.first.createdAt)
    expect(result.updated.etag).not.toBe(result.first.etag)
    expect(Date.parse(result.first.createdAt)).not.toBeNaN()
    expect(Date.parse(result.updated.updatedAt)).not.toBeNaN()
    expect(result.aliasDelta.aliases).toEqual([
      "salesforce:org_1:account:example",
    ])
    expect(result.aliasReplacement.aliases).toEqual(["legacy:company:example"])
    expect(result.aliasConflict).toBeInstanceOf(RecordAliasConflict)
    expect(result.secondAfterConflict.aliases).toEqual([
      "hubspot:portal_1:company:bravo",
    ])
    expect(result.resolvedAlias).toBe(result.first.id)
    expect(result.foundByAlias.id).toBe(result.first.id)
    expect(result.removedAlias).toBeInstanceOf(RecordAliasNotFound)
    expect(result.clearedSecond.aliases).toEqual([])
    expect(result.clearedAlias).toBeInstanceOf(RecordAliasNotFound)
    expect(result.aliasRows).toEqual([
      { alias: "legacy:company:example", objectId: result.first.id },
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
    expect(result.firstPage.nextPageToken).not.toBeNull()
    if (result.firstPage.nextPageToken !== null) {
      expect(result.firstPage.nextPageToken.length).toBeLessThan(256)
    }
    expect(result.firstPage.totalSize).toBe(2)
    expect(result.secondPage.items).toHaveLength(1)
    expect(result.secondPage.nextPageToken).toBeNull()
    expect(result.secondPage.totalSize).toBe(2)
    expect(result.zeroPageSize.items).toHaveLength(2)
    expect(result.oversizedPage.items).toHaveLength(2)
    expect(result.tamperedCursor).toBeInstanceOf(InvalidListRequest)
    expect(result.filtered.items.map(({ id }) => id)).toEqual([result.first.id])
    expect(result.filtered.totalSize).toBe(1)
    expect(result.filteredByAlias.items.map(({ id }) => id)).toEqual([
      result.first.id,
    ])
    expect(result.filteredByAlias.totalSize).toBe(1)
    expect(result.sortedFirstPage.items[0]?.name).toBe("Example Corporation")
    expect(result.sortedFirstPage.totalSize).toBe(2)
    expect(result.sortedSecondPage.items[0]?.name).toBe("Bravo")
    expect(result.sortedSecondPage.totalSize).toBe(2)
    expect(result.mismatchedCursor).toBeInstanceOf(InvalidListRequest)
    expect(result.invalidFilterValue).toBeInstanceOf(InvalidListRequest)
    expect(result.staleWrite).toBeInstanceOf(ObjectWriteConflict)
    expect(result.userWithSharedEmail).toMatchObject({
      email: "unique@example.example",
      name: "Second User",
    })
    expect(result.wrongParent).toBeInstanceOf(ObjectParentTypeMismatch)
    expect(result.wrongTypeAlias).toBeInstanceOf(RecordAliasNotFound)
    expect(result.rolledBack).toBeInstanceOf(ObjectNotFound)
    expect(result.leads.items).toHaveLength(1)
    expect(result.leads.items[0]).toMatchObject({
      email: "lead@example.example",
    })
    expect(result.partyRows.map(({ id }) => id)).toEqual([
      result.first.id,
      result.second.id,
    ])
    expect(result.inconsistentParent).toBeDefined()
    expect(result.lineItem).toMatchObject({
      name: "Implementation",
      parent: "deal_1",
      quantity: 1,
    })
    expect(result.storedDeals).toEqual([
      expect.objectContaining({
        id: "deal_1",
        parentId: result.first.id,
      }),
    ])
    expect(result.lineItemKindRows).toEqual([
      expect.objectContaining({
        parentId: "deal_1",
        id: result.lineItem.id,
      }),
    ])
    expect(
      result.lineItemObjectRows.find(({ id }) => id === result.lineItem.id)
    ).toMatchObject({
      ancestorIds: ["deal_1", result.first.id, ROOT_ID],
    })
    for (const object of Object.values(Model.objects)) {
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
          "parent_id",
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
