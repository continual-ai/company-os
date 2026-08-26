import { Effect, Schema } from "effect"
import { describe, expect, expectTypeOf, it } from "vitest"

import {
  defineObject,
  Etag,
  type RecordAliasUpdate,
  type ObjectRecord,
} from "./definition/object"
import {
  DEFAULT_PAGE_SIZE,
  MAX_BATCH_DELETE_SIZE,
  MAX_BATCH_GET_SIZE,
  PageToken,
} from "./definition/request"
import { defineRoot } from "./definition/root"
import {
  EmailAddress,
  RecordAlias,
  type RecordAlias as RecordAliasType,
  RecordId,
  schema,
  Timestamp,
} from "./definition/schema"
import {
  RecordAliasConflict,
  ObjectNotFound,
  ObjectWriteConflict,
  type Repository,
} from "./effect-object-repository"
import * as ObjectService from "./effect-object-service"

const Platform = defineRoot({ id: "platform", name: "Platform" })
const PlatformId = RecordId("platform")
const UserId = RecordId("user")

const Account = defineObject({
  id: "account",
  collection: "accounts",
  name: "Account",
  parent: Platform,
  pluralName: "Accounts",
  properties: {
    email: schema.email({ nullable: true }),
    name: schema.string({ minLength: 1 }),
    slug: schema.string({ immutable: true }),
    status: schema.select({
      default: "active",
      options: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
      ],
    }),
  },
  display: { status: "status", title: "name" },
})

const ReadOnlyAccount = defineObject({
  id: "readOnlyAccount",
  collection: "readOnlyAccounts",
  name: "Read-only account",
  parent: Platform,
  pluralName: "Read-only accounts",
  actions: {
    batchDelete: false,
    create: false,
    delete: false,
    update: false,
  },
  properties: { name: schema.string() },
  display: { title: "name" },
})

type AccountRecord = ObjectRecord<typeof Account>
type RepositoryError =
  | RecordAliasConflict
  | ObjectNotFound
  | ObjectWriteConflict

function isAliasReplacement(
  update: RecordAliasUpdate
): update is ReadonlyArray<RecordAliasType> {
  return Array.isArray(update)
}

function sortedAliases(
  aliases: ReadonlyArray<RecordAliasType>
): ReadonlyArray<RecordAliasType> {
  // This array is a fresh snapshot owned by the in-memory test adapter.
  // oxlint-disable-next-line unicorn/no-array-sort
  return [...aliases].sort()
}

function makeRepository(
  aliasOwners: Map<RecordAliasType, string>
): Repository<typeof Account, RepositoryError> {
  const records = new Map<string, AccountRecord>()
  const createdAt = Timestamp("2026-08-23T00:00:00.000Z")
  const updatedAt = Timestamp("2026-08-23T00:00:01.000Z")
  let version = 0
  const nextEtag = () => Etag(`etag_${++version}`)

  const claimAliases = (
    id: RecordId<"account">,
    aliases: ReadonlyArray<RecordAliasType>
  ) => {
    const conflict = aliases
      .map((alias) => ({ alias, owner: aliasOwners.get(alias) }))
      .find(({ owner }) => owner !== undefined && owner !== id)
    if (conflict?.owner !== undefined) {
      return Effect.fail(
        new RecordAliasConflict({
          alias: conflict.alias,
          conflictingRecordId: conflict.owner,
          recordId: id,
        })
      )
    }
    return Effect.sync(() => {
      for (const alias of aliases) aliasOwners.set(alias, id)
    })
  }

  const releaseAliases = (
    id: RecordId<"account">,
    aliases: ReadonlyArray<RecordAliasType>
  ) => {
    for (const alias of aliases) {
      if (aliasOwners.get(alias) === id) aliasOwners.delete(alias)
    }
  }

  const get = (
    id: RecordId<"account">
  ): Effect.Effect<AccountRecord, ObjectNotFound> => {
    const record = records.get(id)
    if (record === undefined) {
      return Effect.fail(
        new ObjectNotFound({ objectType: Account.id, recordId: id })
      )
    }
    return Effect.succeed(record)
  }

  return {
    batchDelete: (targets) =>
      Effect.gen(function* () {
        const current = yield* Effect.forEach(targets, ({ id }) => get(id))
        const conflictIndex = current.findIndex(
          (record, index) => record.etag !== targets[index]?.etag
        )
        if (conflictIndex !== -1) {
          return yield* Effect.fail(
            new ObjectWriteConflict({
              objectType: Account.id,
              recordId: targets[conflictIndex]!.id,
            })
          )
        }
        yield* Effect.sync(() => {
          for (const { id } of targets) {
            const record = records.get(id)
            if (record !== undefined) releaseAliases(id, record.aliases)
            records.delete(id)
          }
        })
        return undefined
      }),
    batchGet: (ids) => Effect.forEach(ids, get),
    delete: ({ etag, id }) =>
      get(id).pipe(
        Effect.flatMap((record) =>
          record.etag !== etag
            ? Effect.fail(
                new ObjectWriteConflict({
                  objectType: Account.id,
                  recordId: id,
                })
              )
            : Effect.sync(() => {
                releaseAliases(id, record.aliases)
                records.delete(id)
              })
        )
      ),
    get,
    insert: (record) =>
      Effect.gen(function* () {
        yield* claimAliases(record.id, record.aliases)
        const hydrated: AccountRecord = {
          ...record,
          aliases: sortedAliases(record.aliases),
          createdAt,
          email: record.email ?? null,
          etag: nextEtag(),
          status: record.status ?? "active",
          updatedAt: createdAt,
        }
        records.set(record.id, hydrated)
        return hydrated
      }),
    list: (request = {}) =>
      Effect.sync(() => {
        const size = Math.max(1, request.pageSize ?? DEFAULT_PAGE_SIZE)
        // This array is a fresh snapshot owned by the in-memory test adapter.
        // oxlint-disable-next-line unicorn/no-array-sort
        const sorted = [...records.values()].sort((left, right) =>
          left.id.localeCompare(right.id)
        )
        const start =
          request.pageToken === undefined
            ? 0
            : sorted.findIndex(
                ({ id }) => String(id) > String(request.pageToken)
              )
        const candidates =
          start < 0 ? [] : sorted.slice(start, start + size + 1)
        const hasNextPage = candidates.length > size
        const items = hasNextPage ? candidates.slice(0, size) : candidates
        return {
          items,
          nextPageToken: hasNextPage ? PageToken(items.at(-1)!.id) : "",
        }
      }),
    update: ({ aliases, etag, id, updatedBy, ...changes }) =>
      get(id).pipe(
        Effect.flatMap((record) =>
          Effect.gen(function* () {
            if (record.etag !== etag) {
              return yield* Effect.fail(
                new ObjectWriteConflict({
                  objectType: Account.id,
                  recordId: id,
                })
              )
            }
            let updatedAliases = record.aliases
            if (aliases !== undefined) {
              if (isAliasReplacement(aliases)) {
                yield* claimAliases(id, aliases)
                releaseAliases(
                  id,
                  record.aliases.filter((alias) => !aliases.includes(alias))
                )
                updatedAliases = sortedAliases(aliases)
              } else {
                const add = aliases.add ?? []
                const remove = aliases.remove ?? []
                yield* claimAliases(id, add)
                releaseAliases(id, remove)
                updatedAliases = sortedAliases(
                  [...new Set([...record.aliases, ...add])].filter(
                    (alias) => !remove.includes(alias)
                  )
                )
              }
            }
            const updated: AccountRecord = {
              ...record,
              ...changes,
              aliases: updatedAliases,
              etag: nextEtag(),
              updatedAt,
              updatedBy,
            }
            records.set(id, updated)
            return updated
          })
        )
      ),
    upsert: (record) =>
      Effect.gen(function* () {
        yield* claimAliases(record.id, record.aliases)
        const existing = records.get(record.id)
        if (existing !== undefined) {
          releaseAliases(
            record.id,
            existing.aliases.filter((alias) => !record.aliases.includes(alias))
          )
        }
        const hydrated: AccountRecord = {
          ...record,
          aliases: sortedAliases(record.aliases),
          createdAt: existing?.createdAt ?? createdAt,
          email: record.email ?? null,
          etag: nextEtag(),
          status: record.status ?? "active",
          updatedAt,
        }
        records.set(record.id, hydrated)
        return hydrated
      }),
  }
}

describe("ObjectService", () => {
  it("omits mutations disabled by the object definition", () => {
    type ReadOnlyService = ObjectService.Service<typeof ReadOnlyAccount>

    expectTypeOf<ReadOnlyService>().toHaveProperty("get")
    expectTypeOf<ReadOnlyService>().toHaveProperty("list")
    expectTypeOf<ReadOnlyService>().toHaveProperty("batchGet")
    expectTypeOf<ReadOnlyService>().not.toHaveProperty("create")
    expectTypeOf<ReadOnlyService>().not.toHaveProperty("update")
    expectTypeOf<ReadOnlyService>().not.toHaveProperty("delete")
    expectTypeOf<ReadOnlyService>().not.toHaveProperty("batchDelete")
  })

  it("generates sortable TypeIDs by default", async () => {
    const rootId = PlatformId("platform_1")
    const service = ObjectService.make(Account, makeRepository(new Map()), {
      authorize: () => Effect.void,
      rootId,
      resolveRecordAliases: (_expectedType, aliases) =>
        Effect.fail(
          new ObjectNotFound({
            objectType: Account.id,
            recordId: aliases[0]!,
          })
        ),
      visibleWithin: () => Effect.succeed([rootId]),
    })

    const record = await Effect.runPromise(
      service.create({ name: "Example", slug: "example" }).pipe(
        Effect.provideService(ObjectService.CurrentInvocation, {
          actorId: UserId("user_1"),
          authorizationActorId: UserId("user_1"),
        })
      )
    )

    expect(record.id).toMatch(/^account_[0-9a-hjkmnp-tv-z]{26}$/)
  })

  it("provides validated CRUD, atomic batching, pagination, and optimistic writes", async () => {
    let nextId = 0
    const accessRequests: Array<ObjectService.ObjectAccessRequest> = []
    const aliasResolutionRequests: Array<ReadonlyArray<RecordAliasType>> = []
    const aliasOwners = new Map<RecordAliasType, string>()
    const repository = makeRepository(aliasOwners)
    const context = {
      actorId: UserId("user_1"),
      authorizationActorId: UserId("user_1"),
    }
    const rootId = PlatformId("platform_1")
    const service = ObjectService.make(Account, repository, {
      authorize: (request) => {
        accessRequests.push(request)
        return Effect.void
      },
      generateRecordId: () => `account_${++nextId}`,
      rootId,
      resolveRecordAliases: (_expectedType, aliases) => {
        aliasResolutionRequests.push(aliases)
        return Effect.forEach(aliases, (alias) => {
          const id = aliasOwners.get(alias)
          return id === undefined
            ? Effect.fail(
                new ObjectNotFound({
                  objectType: Account.id,
                  recordId: alias,
                })
              )
            : Effect.succeed(id)
        })
      },
      visibleWithin: () => Effect.succeed([rootId]),
    })

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const hubspotExample = RecordAlias("hubspot:portal_1:company:example")
        const hubspotBravo = RecordAlias("hubspot:portal_1:company:bravo")
        const salesforceExample = RecordAlias(
          "salesforce:org_1:account:example"
        )
        const legacyExample = RecordAlias("legacy:company:example")
        const legacyCharlie = RecordAlias("legacy:company:charlie")
        const invalidCreate = yield* service
          .create({ name: "", slug: "invalid" })
          .pipe(Effect.flip)
        const first = yield* service.create({
          aliases: [hubspotExample],
          email: EmailAddress("Sales@Example.Example"),
          name: "Example",
          slug: "example",
        })
        const second = yield* service.create({
          aliases: [hubspotBravo],
          name: "Bravo",
          slug: "bravo",
        })
        const updated = yield* service.update({
          id: first.id,
          name: "Example Corporation",
        })
        const invalidUpdate = yield* service
          .update({ id: first.id, name: "" })
          .pipe(Effect.flip)
        const batch = yield* service.batchGet({ ids: [second.id, first.id] })
        const emptyBatchGet = yield* service
          .batchGet({ ids: [] })
          .pipe(Effect.flip)
        const oversizedBatchGet = yield* service
          .batchGet({
            ids: Array.from({ length: MAX_BATCH_GET_SIZE + 1 }, (_, index) =>
              RecordId(Account.id)(`account_oversized_${index}`)
            ),
          })
          .pipe(Effect.flip)
        const firstPage = yield* service.list({ pageSize: 1 })
        if (firstPage.nextPageToken === "") {
          return yield* Effect.die("Expected another page")
        }
        const secondPage = yield* service.list({
          pageSize: 1,
          pageToken: firstPage.nextPageToken,
        })
        const staleWrite = yield* repository
          .update({
            etag: first.etag,
            id: first.id,
            name: "Stale",
            updatedBy: context.actorId,
          })
          .pipe(Effect.flip)
        const staleServiceWrite = yield* service
          .update({ etag: first.etag, id: first.id, name: "Also stale" })
          .pipe(Effect.flip)
        const immutableWrite = yield* service
          .update({ id: first.id, slug: "different" })
          .pipe(Effect.flip)
        const aliasDelta = yield* service.update({
          aliases: { add: [salesforceExample], remove: [hubspotExample] },
          id: first.id,
        })
        const aliasReplacement = yield* service.update({
          aliases: [legacyExample],
          id: first.id,
        })
        const foundByAlias = yield* service.get({ id: legacyExample })
        const updatedByAlias = yield* service.update({
          id: legacyExample,
          name: "Example, Inc.",
        })
        const aliasBatch = yield* service.batchGet({
          ids: [hubspotBravo, legacyExample],
        })
        const aliasConflict = yield* service
          .update({
            aliases: { add: [legacyExample] },
            id: second.id,
          })
          .pipe(Effect.flip)
        const duplicateAliasUpdate = yield* service
          .update({ aliases: [legacyExample, legacyExample], id: first.id })
          .pipe(Effect.flip)
        const overlappingAliasUpdate = yield* service
          .update({
            aliases: { add: [legacyExample], remove: [legacyExample] },
            id: first.id,
          })
          .pipe(Effect.flip)
        const third = yield* service.create({
          aliases: [legacyCharlie],
          name: "Charlie",
          slug: "charlie",
        })
        const fourth = yield* service.create({ name: "Delta", slug: "delta" })
        const duplicateBatchDelete = yield* service
          .batchDelete({ ids: [third.id, legacyCharlie] })
          .pipe(Effect.flip)
        const emptyBatchDelete = yield* service
          .batchDelete({ ids: [] })
          .pipe(Effect.flip)
        const oversizedBatchDelete = yield* service
          .batchDelete({
            ids: Array.from({ length: MAX_BATCH_DELETE_SIZE + 1 }, (_, index) =>
              RecordId(Account.id)(`account_oversized_${index}`)
            ),
          })
          .pipe(Effect.flip)
        yield* service.batchDelete({ ids: [third.id, fourth.id] })
        const deleted = yield* repository.get(third.id).pipe(Effect.flip)

        return {
          aliasConflict,
          aliasBatch,
          aliasDelta,
          aliasReplacement,
          batch,
          deleted,
          duplicateBatchDelete,
          duplicateAliasUpdate,
          emptyBatchGet,
          emptyBatchDelete,
          first,
          firstPage,
          foundByAlias,
          invalidCreate,
          invalidUpdate,
          immutableWrite,
          oversizedBatchDelete,
          oversizedBatchGet,
          overlappingAliasUpdate,
          second,
          secondPage,
          staleWrite,
          staleServiceWrite,
          updated,
          updatedByAlias,
        }
      }).pipe(Effect.provideService(ObjectService.CurrentInvocation, context))
    )

    expect(result.first).toMatchObject({
      aliases: ["hubspot:portal_1:company:example"],
      email: "sales@example.example",
      id: "account_1",
      name: "Example",
      systemManaged: false,
      parent: "platform_1",
      slug: "example",
      status: "active",
    })
    expect(result.updated).toMatchObject({
      id: result.first.id,
      name: "Example Corporation",
      slug: "example",
    })
    expect(result.invalidCreate).toBeInstanceOf(Schema.SchemaError)
    expect(result.invalidUpdate).toBeInstanceOf(Schema.SchemaError)
    expect(result.aliasDelta.aliases).toEqual([
      "salesforce:org_1:account:example",
    ])
    expect(result.aliasReplacement.aliases).toEqual(["legacy:company:example"])
    expect(result.foundByAlias.id).toBe(result.first.id)
    expect(result.updatedByAlias).toMatchObject({
      id: result.first.id,
      name: "Example, Inc.",
    })
    expect(result.aliasConflict).toBeInstanceOf(RecordAliasConflict)
    expect(result.duplicateAliasUpdate).toBeInstanceOf(Schema.SchemaError)
    expect(result.overlappingAliasUpdate).toBeInstanceOf(Schema.SchemaError)
    expect(result.batch.items.map(({ id }) => id)).toEqual([
      result.second.id,
      result.first.id,
    ])
    expect(result.aliasBatch.items.map(({ id }) => id)).toEqual([
      result.second.id,
      result.first.id,
    ])
    expect(aliasResolutionRequests).toContainEqual([
      "hubspot:portal_1:company:bravo",
      "legacy:company:example",
    ])
    expect(result.firstPage.nextPageToken).not.toBe("")
    expect(result.secondPage.nextPageToken).toBe("")
    expect(result.staleWrite).toBeInstanceOf(ObjectWriteConflict)
    expect(result.staleServiceWrite).toBeInstanceOf(ObjectWriteConflict)
    expect(result.immutableWrite).toBeInstanceOf(
      ObjectService.ImmutablePropertyError
    )
    expect(result.duplicateBatchDelete).toBeInstanceOf(
      ObjectService.InvalidBatchRequest
    )
    expect(result.duplicateBatchDelete).toMatchObject({
      operation: "batchDelete",
    })
    expect(result.emptyBatchDelete).toBeInstanceOf(
      ObjectService.InvalidBatchRequest
    )
    expect(result.oversizedBatchDelete).toBeInstanceOf(
      ObjectService.InvalidBatchRequest
    )
    expect(result.emptyBatchGet).toBeInstanceOf(
      ObjectService.InvalidBatchRequest
    )
    expect(result.emptyBatchGet).toMatchObject({ operation: "batchGet" })
    expect(result.oversizedBatchGet).toBeInstanceOf(
      ObjectService.InvalidBatchRequest
    )
    expect(result.deleted).toBeInstanceOf(ObjectNotFound)
    expect(accessRequests[0]).toEqual({
      objectType: "account",
      operation: "create",
      parentId: "platform_1",
      parentTypeId: "platform",
    })
    expect(accessRequests.at(-1)).toEqual({
      objectType: "account",
      operation: "batchDelete",
      recordIds: ["account_3", "account_4"],
    })
  })
})
