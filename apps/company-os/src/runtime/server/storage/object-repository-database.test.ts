import { Effect, Schema } from "effect"
import { describe, expect } from "vitest"

import { User } from "#/runtime/access/model/index.ts"
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
import { SYSTEM_SERVICE_ACCOUNT_ID } from "#/runtime/model/system-records.ts"
import { ObjectRepositories } from "#/runtime/server/model/object-repositories.ts"
import {
  InvalidBatchRequest,
  makeObjectService,
} from "#/runtime/server/model/object-service.ts"
import { RecordIdentifierResolver } from "#/runtime/server/model/record-identifier-resolver.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import {
  assignments,
  tableProjection,
  type TableRow,
} from "#/runtime/server/storage/index.ts"
import {
  InvalidListRequest,
  ObjectNotFound,
  ObjectWriteConflict,
  RecordAliasConflict,
  RecordAliasNotFound,
} from "#/runtime/server/storage/object-repository.ts"
import {
  Account,
  fixtureModel,
  Order,
  OrderLine,
  Prospect,
} from "#/runtime/testing/fixture-model.ts"
import { FixtureServer } from "#/runtime/testing/fixture-server.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const fixture = testFoundation(fixtureModel, { servers: [FixtureServer] })
const { objects, recordAliases } = fixture.storage.core
const participants = fixture.storage.interfaces.participant
const orders = fixture.storage.objects.order
const orderLines = fixture.storage.objects.orderLine
const AccountId = RecordId("account")

function omitStorageFields<
  TRecord extends {
    readonly objectType: unknown
    readonly links: unknown
    readonly createdAt: unknown
    readonly etag: unknown
    readonly updatedAt: unknown
  },
>(
  record: TRecord
): Omit<TRecord, "objectType" | "links" | "createdAt" | "etag" | "updatedAt"> {
  const {
    objectType: _objectType,
    links: _links,
    createdAt: _createdAt,
    etag: _etag,
    updatedAt: _updatedAt,
    ...insert
  } = record
  return insert
}

function snakeCase(value: string): string {
  return value.replaceAll(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()
}

const TYPE_ID = /^[a-z_]+_[0-9a-hjkmnp-tv-z]{26}$/

describe("Effect SQL object repository", () => {
  fixture.test(
    "preserves object invariants across standard methods",
    () =>
      Effect.gen(function* () {
        const database = yield* Database
        const sql = database.sql
        const identifiers = yield* RecordIdentifierResolver
        const records = yield* ObjectRepositories
        const repository = records.get(Account)
        const service = yield* makeObjectService(Account)
        const prospectService = yield* makeObjectService(Prospect)
        const orderService = yield* makeObjectService(Order)
        const orderLineService = yield* makeObjectService(OrderLine)

        const hubspotExample = RecordAlias("hubspot:portal_1:account:example")
        const hubspotBravo = RecordAlias("hubspot:portal_1:account:bravo")
        const legacyExample = RecordAlias("legacy:account:example")
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
          "account",
          legacyExample
        )
        const foundByAlias = yield* service.get({ id: legacyExample })
        const removedAlias = yield* identifiers
          .resolve("account", hubspotExample)
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
              AccountId(`account_oversized_${index}`)
            ),
          })
          .pipe(Effect.flip)
        const clearedSecond = yield* service.update({
          aliases: [],
          id: second.id,
        })
        const clearedAlias = yield* identifiers
          .resolve("account", hubspotBravo)
          .pipe(Effect.flip)
        yield* sql`update ${objects} set ${assignments(sql, objects, { createdAt: "2001-01-01T00:00:00.000123Z" })}
          where ${objects.columns.id} = ${first.id}`
        yield* sql`update ${objects} set ${assignments(sql, objects, { createdAt: "2001-01-01T00:00:00.000456Z" })}
          where ${objects.columns.id} = ${second.id}`
        const firstPage = yield* service.list({ pageSize: 1 })
        if (firstPage.nextPageToken === null) {
          throw new Error("Expected another page")
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
          throw new Error("Expected tied timestamp page")
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
          throw new Error("Expected another sorted page")
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
        const userRepository = records.get(User)
        const userRecord = {
          aliases: [],
          createdBy: SYSTEM_SERVICE_ACCOUNT_ID,
          email: EmailAddress("unique@example.example"),
          image: null,
          metadata: {},
          name: "First User",
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
        const rollbackId = AccountId("account_rollback")
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

        const prospect = yield* prospectService.create({
          accountName: "Example",
          email: EmailAddress("Prospect@Example.Example"),
          name: "Ada",
        })
        const prospects = yield* prospectService.list({
          filter: {
            field: "email",
            operator: "eq",
            value: EmailAddress("Prospect@Example.Example"),
          },
        })
        const wrongTypeAlias = yield* prospectService
          .get({ id: legacyExample })
          .pipe(Effect.flip)
        const convertedAt = Timestamp("2024-01-01T00:00:00.000Z")
        const writerOutput = yield* records
          .writer(Prospect)
          .update({ id: prospect.id, convertedAt })

        const order = yield* orderService.create({
          name: "Expansion",
          links: { account: [legacyExample] },
        })
        const storedOrders = yield* sql<
          TableRow<typeof orders>
        >`select ${tableProjection(orders)}
          from ${orders}`
        const orderLine = yield* orderLineService.create({
          name: "Implementation",
          links: { order: [order.id] },
        })
        const batchDeleteFailure = yield* service
          .batchDelete({ ids: [second.id, first.id] })
          .pipe(Effect.flip)
        const retainedAfterBatchDelete = yield* service.batchGet({
          ids: [second.id, first.id],
        })
        const third = yield* service.create({
          aliases: [RecordAlias("legacy:account:charlie")],
          name: "Charlie",
        })
        const fourth = yield* service.create({ name: "Delta" })
        const duplicateBatchDelete = yield* service
          .batchDelete({
            ids: [third.id, RecordAlias("legacy:account:charlie")],
          })
          .pipe(Effect.flip)
        const emptyBatchDelete = yield* service
          .batchDelete({ ids: [] })
          .pipe(Effect.flip)
        const oversizedBatchDelete = yield* service
          .batchDelete({
            ids: Array.from({ length: MAX_BATCH_DELETE_SIZE + 1 }, (_, index) =>
              AccountId(`account_oversized_${index}`)
            ),
          })
          .pipe(Effect.flip)
        yield* service.batchDelete({ ids: [third.id, fourth.id] })
        const deleted = yield* repository.get(third.id).pipe(Effect.flip)
        const orderLineRows = yield* sql<
          TableRow<typeof orderLines>
        >`select ${tableProjection(orderLines)}
          from ${orderLines}`
        const objectRows = yield* sql<
          TableRow<typeof objects>
        >`select ${tableProjection(objects)}
          from ${objects}`
        const aliasRows = yield* sql<
          TableRow<typeof recordAliases>
        >`select ${tableProjection(recordAliases)}
          from ${recordAliases}`
        const participantRows = yield* sql<
          TableRow<typeof participants>
        >`select ${tableProjection(participants)}
          from ${participants}
          order by ${participants.columns.id}`
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

        expect(invalidCreate).toBeInstanceOf(Schema.SchemaError)
        expect(first).toMatchObject({
          aliases: ["hubspot:portal_1:account:example"],
          domain: "example.example",
          id: expect.stringMatching(TYPE_ID),
          stage: "prospect",
          name: "Example",
        })
        expect(updated).toMatchObject({
          id: first.id,
          name: "Example Corporation",
        })
        expect(updated.createdAt).toBe(first.createdAt)
        expect(updated.etag).not.toBe(first.etag)
        expect(Date.parse(first.createdAt)).not.toBeNaN()
        expect(Date.parse(updated.updatedAt)).not.toBeNaN()
        expect(staleServiceWrite).toBeInstanceOf(ObjectWriteConflict)
        expect(aliasDelta.aliases).toEqual(["salesforce:org_1:account:example"])
        expect(aliasReplacement.aliases).toEqual(["legacy:account:example"])
        expect(aliasConflict).toBeInstanceOf(RecordAliasConflict)
        expect(secondAfterConflict.aliases).toEqual([
          "hubspot:portal_1:account:bravo",
        ])
        expect(resolvedAlias).toBe(first.id)
        expect(foundByAlias.id).toBe(first.id)
        expect(removedAlias).toBeInstanceOf(RecordAliasNotFound)
        expect(clearedSecond.aliases).toEqual([])
        expect(clearedAlias).toBeInstanceOf(RecordAliasNotFound)
        expect(aliasRows).toEqual([
          { alias: "legacy:account:example", objectId: first.id },
        ])
        expect(batch.items.map(({ id }) => id)).toEqual([second.id, first.id])
        expect(emptyBatchGet).toBeInstanceOf(InvalidBatchRequest)
        expect(emptyBatchGet).toMatchObject({ operation: "batchGet" })
        expect(oversizedBatchGet).toBeInstanceOf(InvalidBatchRequest)
        expect(batchDeleteFailure).toBeDefined()
        expect(retainedAfterBatchDelete.items.map(({ id }) => id)).toEqual([
          second.id,
          first.id,
        ])
        expect(duplicateBatchDelete).toBeInstanceOf(InvalidBatchRequest)
        expect(duplicateBatchDelete).toMatchObject({
          operation: "batchDelete",
        })
        expect(emptyBatchDelete).toBeInstanceOf(InvalidBatchRequest)
        expect(oversizedBatchDelete).toBeInstanceOf(InvalidBatchRequest)
        expect(deleted).toBeInstanceOf(ObjectNotFound)
        expect(firstPage.items.map(({ id }) => id)).toEqual([second.id])
        expect(firstPage.nextPageToken.length).toBeLessThan(256)
        expect(firstPage.totalSize).toBe(2)
        expect(secondPage.items.map(({ id }) => id)).toEqual([first.id])
        expect(secondPage.nextPageToken).toBeNull()
        expect(secondPage.totalSize).toBe(2)
        expect(zeroPageSize.items).toHaveLength(2)
        expect(oversizedPage.items).toHaveLength(2)
        expect(tamperedCursor).toBeInstanceOf(InvalidListRequest)
        expect(filtered.items.map(({ id }) => id)).toEqual([first.id])
        expect(filtered.totalSize).toBe(1)
        expect(filteredByAlias.items.map(({ id }) => id)).toEqual([first.id])
        expect(filteredByAlias.totalSize).toBe(1)
        expect(sortedFirstPage.items[0]?.name).toBe("Example Corporation")
        expect(sortedFirstPage.totalSize).toBe(2)
        expect(sortedSecondPage.items[0]?.name).toBe("Bravo")
        expect(sortedSecondPage.totalSize).toBe(2)
        expect(mismatchedCursor).toBeInstanceOf(InvalidListRequest)
        expect(invalidFilterValue).toBeInstanceOf(InvalidListRequest)
        expect(staleWrite).toBeInstanceOf(ObjectWriteConflict)
        expect(userWithSharedEmail).toMatchObject({
          email: "unique@example.example",
          name: "Second User",
        })
        expect(wrongTypeAlias).toBeInstanceOf(RecordAliasNotFound)
        expect(rolledBack).toBeInstanceOf(ObjectNotFound)
        expect(prospects.items).toHaveLength(1)
        expect(prospects.items[0]).toMatchObject({
          email: "prospect@example.example",
        })
        expect(writerOutput.convertedAt).toBe("2024-01-01T00:00:00.000Z")
        expect(participantRows.map(({ id }) => id)).toEqual(
          [first.id, second.id].sort()
        )
        expect(orderLine).toMatchObject({
          name: "Implementation",
          links: { order: { ids: [order.id], totalSize: 1 } },
          quantity: 1,
        })
        expect(storedOrders).toEqual([
          expect.objectContaining({ id: order.id }),
        ])
        expect(orderLineRows).toEqual([
          expect.objectContaining({ id: orderLine.id }),
        ])
        expect(orderLine.links.order?.ids).toEqual([order.id])
        expect(objectRows).toContainEqual(
          expect.objectContaining({ id: orderLine.id, objectType: "orderLine" })
        )
        for (const object of Object.values(fixture.model.objects)) {
          expect(
            new Set(
              columns
                .filter(
                  ({ tableName }) => tableName === snakeCase(object.collection)
                )
                .map(({ columnName }) => columnName)
            )
          ).toEqual(
            new Set([
              "id",
              ...Object.entries(object.properties).map(
                ([propertyId, property]) =>
                  snakeCase(
                    property.kind === "recordId"
                      ? `${propertyId}Id`
                      : propertyId
                  )
              ),
            ])
          )
        }
      }),
    10_000
  )
})
