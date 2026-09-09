import { Effect, Layer, Schema } from "effect"
import { describe, expect, expectTypeOf } from "vitest"

import { Model } from "#/app.model.ts"
import { itDatabase } from "#/app/server/database/it-database.ts"
import { applyMigrations } from "#/app/server/database/migrations.ts"
import { Storage } from "#/app/server/database/schema.ts"
import {
  lineItems,
  objects,
  parties,
  recordAliases,
} from "#/app/server/database/schema.ts"
import { seedSystem } from "#/app/server/seeds/seed-system.ts"
import {
  DomainName,
  EmailAddress,
  MAX_BATCH_DELETE_SIZE,
  MAX_BATCH_GET_SIZE,
  PageToken,
  RecordAlias,
  RecordId,
  Timestamp,
} from "#/runtime/model/index.ts"
import {
  ROOT_ID,
  SYSTEM_SERVICE_ACCOUNT_ID,
} from "#/runtime/model/system-records.ts"
import { foundationLayer } from "#/runtime/server/foundation.ts"
import { systemInvocation } from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { ObjectRepositories } from "#/runtime/server/model/object-repositories.ts"
import {
  InvalidBatchRequest,
  makeObjectService,
} from "#/runtime/server/model/object-service.ts"
import { RecordIdentifierResolver } from "#/runtime/server/model/record-identifier-resolver.ts"
import { PageTokens } from "#/runtime/server/page-tokens.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import { assignments } from "#/runtime/server/storage/index.ts"
import {
  tableProjection,
  type TableRow,
} from "#/runtime/server/storage/index.ts"
import {
  InvalidListRequest,
  ObjectNotFound,
  ObjectParentTypeMismatch,
  ObjectWriteConflict,
  RecordAliasConflict,
  RecordAliasNotFound,
} from "#/runtime/server/storage/object-repository.ts"

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

const TYPE_ID = /^[a-z_]+_[0-9a-hjkmnp-tv-z]{26}$/

describe("Effect SQL object repository", () => {
  itDatabase(
    "migrates and preserves object invariants across standard methods",
    Effect.fn(function* () {
      const root = ROOT_ID
      const database = yield* Database
      const sql = database.sql
      yield* applyMigrations()
      yield* applyMigrations()
      yield* seedSystem()
      const result = yield* Effect.gen(function* () {
        const identifiers = yield* RecordIdentifierResolver
        const records = yield* ObjectRepositories
        const repository = records.get(Model.objects.company)
        const service = yield* makeObjectService(Model.objects.company)
        const leadService = yield* makeObjectService(Model.objects.lead)
        const dealService = yield* makeObjectService(Model.objects.deal)
        const lineItemService = yield* makeObjectService(Model.objects.lineItem)

        const hubspotExample = RecordAlias("hubspot:portal_1:company:example")
        const hubspotBravo = RecordAlias("hubspot:portal_1:company:bravo")
        const legacyExample = RecordAlias("legacy:company:example")
        const salesforceExample = RecordAlias(
          "salesforce:org_1:account:example"
        )
        const invalidCreate = yield* service
          .create({ name: "" })
          .pipe(Effect.flip)
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
        const staleServiceWrite = yield* service
          .update({ etag: first.etag, id: first.id, name: "Also stale" })
          .pipe(Effect.flip)
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
        const emptyBatchGet = yield* service
          .batchGet({ ids: [] })
          .pipe(Effect.flip)
        const oversizedBatchGet = yield* service
          .batchGet({
            ids: Array.from({ length: MAX_BATCH_GET_SIZE + 1 }, (_, index) =>
              CompanyId(`company_oversized_${index}`)
            ),
          })
          .pipe(Effect.flip)
        const clearedSecond = yield* service.update({
          aliases: [],
          id: second.id,
        })
        const clearedAlias = yield* identifiers
          .resolve("company", hubspotBravo)
          .pipe(Effect.flip)
        yield* sql`update ${objects} set ${assignments(sql, objects, { createdAt: "2001-01-01T00:00:00.000123Z" })}
          where ${objects.columns.id} = ${first.id}`
        yield* sql`update ${objects} set ${assignments(sql, objects, { createdAt: "2001-01-01T00:00:00.000456Z" })}
          where ${objects.columns.id} = ${second.id}`
        const firstPage = yield* service.list({ pageSize: 1 })
        if (firstPage.nextPageToken === null) {
          return yield* Effect.die("Expected another page")
        }
        const secondPage = yield* service.list({
          pageSize: 1,
          pageToken: firstPage.nextPageToken,
        })
        yield* sql`update ${objects} set ${assignments(sql, objects, { createdAt: "2001-01-01T00:00:00.000123Z" })}
          where ${objects.columns.id} = ${second.id}`
        const tiedFirst = yield* service.list({ pageSize: 1 })
        expect(tiedFirst.items.map(({ id }) => id)).toEqual([second.id])
        if (tiedFirst.nextPageToken === null)
          return yield* Effect.die("Expected tied timestamp page")
        const tiedSecond = yield* service.list({
          pageSize: 1,
          pageToken: tiedFirst.nextPageToken,
        })
        expect(tiedSecond.items.map(({ id }) => id)).toEqual([first.id])
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
        const userRepository = records.get(Model.objects.user)
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
        yield* database
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

        const lead = yield* leadService.create({
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
        const convertedAt = Timestamp("2024-01-01T00:00:00.000Z")
        const writerOutput = yield* records
          .writer(Model.objects.lead)
          .update({ id: lead.id, convertedAt })

        const deal = yield* dealService.create({
          name: "Expansion",
          parent: legacyExample,
        })
        const storedDeals = yield* sql<
          TableRow<typeof Storage.objects.deal>
        >`select ${tableProjection(Storage.objects.deal)}
          from ${Storage.objects.deal}`
        type StoredDeal = (typeof storedDeals)[number]
        expectTypeOf<StoredDeal["parentId"]>().toEqualTypeOf<
          RecordId<"authorizationScope">
        >()
        const lineItem = yield* lineItemService.create({
          name: "Implementation",
          parent: deal.id,
        })
        const inconsistentParent =
          yield* sql`update ${objects} set ${assignments(sql, objects, { parentId: root })}
          where ${objects.columns.id} = ${lineItem.id}`.pipe(Effect.flip)
        const batchDeleteFailure = yield* service
          .batchDelete({ ids: [second.id, first.id] })
          .pipe(Effect.flip)
        const retainedAfterBatchDelete = yield* service.batchGet({
          ids: [second.id, first.id],
        })
        const third = yield* service.create({
          aliases: [RecordAlias("legacy:company:charlie")],
          name: "Charlie",
        })
        const fourth = yield* service.create({ name: "Delta" })
        const duplicateBatchDelete = yield* service
          .batchDelete({
            ids: [third.id, RecordAlias("legacy:company:charlie")],
          })
          .pipe(Effect.flip)
        const emptyBatchDelete = yield* service
          .batchDelete({ ids: [] })
          .pipe(Effect.flip)
        const oversizedBatchDelete = yield* service
          .batchDelete({
            ids: Array.from({ length: MAX_BATCH_DELETE_SIZE + 1 }, (_, index) =>
              CompanyId(`company_oversized_${index}`)
            ),
          })
          .pipe(Effect.flip)
        yield* service.batchDelete({ ids: [third.id, fourth.id] })
        const deleted = yield* repository.get(third.id).pipe(Effect.flip)
        const lineItemKindRows = yield* sql<
          TableRow<typeof lineItems>
        >`select ${tableProjection(lineItems)}
          from ${lineItems}`
        const lineItemObjectRows = yield* sql<
          TableRow<typeof objects>
        >`select ${tableProjection(objects)}
          from ${objects}`
        const aliasRows = yield* sql<
          TableRow<typeof recordAliases>
        >`select ${tableProjection(recordAliases)}
          from ${recordAliases}`
        const partyRows = yield* sql<
          TableRow<typeof parties>
        >`select ${tableProjection(parties)}
          from ${parties}`
        const columns = yield* sql<{
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
          deal,
          deleted,
          duplicateBatchDelete,
          emptyBatchDelete,
          emptyBatchGet,
          storedDeals,
          first,
          firstPage,
          filteredByAlias,
          foundByAlias,
          filtered,
          inconsistentParent,
          invalidCreate,
          invalidFilterValue,
          leads,
          lineItem,
          lineItemKindRows,
          lineItemObjectRows,
          mismatchedCursor,
          oversizedBatchDelete,
          oversizedBatchGet,
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
          staleServiceWrite,
          staleWrite,
          tamperedCursor,
          updated,
          userWithSharedEmail,
          writerOutput,
          wrongParent,
          wrongTypeAlias,
          zeroPageSize,
          oversizedPage,
        }
      }).pipe(
        Effect.provideService(CurrentInvocation, systemInvocation),
        Effect.provide(
          foundationLayer(Model, {
            database: Layer.succeed(Database, database),
            pageTokens: PageTokens.layerTest,
          })
        )
      )

      expect(result.invalidCreate).toBeInstanceOf(Schema.SchemaError)
      expect(result.first).toMatchObject({
        aliases: ["hubspot:portal_1:company:example"],
        domain: "example.example",
        id: expect.stringMatching(TYPE_ID),
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
      expect(result.staleServiceWrite).toBeInstanceOf(ObjectWriteConflict)
      expect(result.aliasDelta.aliases).toEqual([
        "salesforce:org_1:account:example",
      ])
      expect(result.aliasReplacement.aliases).toEqual([
        "legacy:company:example",
      ])
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
      expect(result.emptyBatchGet).toBeInstanceOf(InvalidBatchRequest)
      expect(result.emptyBatchGet).toMatchObject({ operation: "batchGet" })
      expect(result.oversizedBatchGet).toBeInstanceOf(InvalidBatchRequest)
      expect(result.batchDeleteFailure).toBeDefined()
      expect(result.retainedAfterBatchDelete.items.map(({ id }) => id)).toEqual(
        [result.second.id, result.first.id]
      )
      expect(result.duplicateBatchDelete).toBeInstanceOf(InvalidBatchRequest)
      expect(result.duplicateBatchDelete).toMatchObject({
        operation: "batchDelete",
      })
      expect(result.emptyBatchDelete).toBeInstanceOf(InvalidBatchRequest)
      expect(result.oversizedBatchDelete).toBeInstanceOf(InvalidBatchRequest)
      expect(result.deleted).toBeInstanceOf(ObjectNotFound)
      expect(result.firstPage.items.map(({ id }) => id)).toEqual([
        result.second.id,
      ])
      expect(result.firstPage.nextPageToken).not.toBeNull()
      if (result.firstPage.nextPageToken !== null) {
        expect(result.firstPage.nextPageToken.length).toBeLessThan(256)
      }
      expect(result.firstPage.totalSize).toBe(2)
      expect(result.secondPage.items.map(({ id }) => id)).toEqual([
        result.first.id,
      ])
      expect(result.secondPage.nextPageToken).toBeNull()
      expect(result.secondPage.totalSize).toBe(2)
      expect(result.zeroPageSize.items).toHaveLength(2)
      expect(result.oversizedPage.items).toHaveLength(2)
      expect(result.tamperedCursor).toBeInstanceOf(InvalidListRequest)
      expect(result.filtered.items.map(({ id }) => id)).toEqual([
        result.first.id,
      ])
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
      expect(result.writerOutput.convertedAt).toBe("2024-01-01T00:00:00.000Z")
      expect(result.partyRows.map(({ id }) => id)).toEqual([
        result.first.id,
        result.second.id,
      ])
      expect(result.inconsistentParent).toBeDefined()
      expect(result.lineItem).toMatchObject({
        name: "Implementation",
        parent: result.deal.id,
        quantity: 1,
      })
      expect(result.storedDeals).toEqual([
        expect.objectContaining({
          id: result.deal.id,
          parentId: result.first.id,
        }),
      ])
      expect(result.lineItemKindRows).toEqual([
        expect.objectContaining({
          parentId: result.deal.id,
          id: result.lineItem.id,
        }),
      ])
      expect(
        result.lineItemObjectRows.find(({ id }) => id === result.lineItem.id)
      ).toMatchObject({
        ancestorIds: [result.deal.id, result.first.id, ROOT_ID],
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
    }),
    10_000
  )
})
