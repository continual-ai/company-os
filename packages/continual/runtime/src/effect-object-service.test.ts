import { Effect, Schema } from "effect"
import { describe, expect, it } from "vitest"

import {
  ActorId,
  defineObject,
  type ObjectAliasUpdate,
  type ObjectRecord,
} from "./definition/object"
import {
  DEFAULT_PAGE_SIZE,
  MAX_BATCH_DELETE_SIZE,
  PageToken,
} from "./definition/request"
import { Root } from "./definition/root"
import {
  ObjectAlias,
  type ObjectAlias as ObjectAliasType,
  RecordId,
  schema,
} from "./definition/schema"
import {
  ObjectAliasConflict,
  ObjectNotFound,
  ObjectWriteConflict,
  type Repository,
} from "./effect-object-repository"
import * as ObjectService from "./effect-object-service"

const RootId = RecordId("root")

const Account = defineObject({
  id: "account",
  collection: "accounts",
  name: "Account",
  parent: Root,
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

type AccountRecord = ObjectRecord<typeof Account>
type RepositoryError =
  | ObjectAliasConflict
  | ObjectNotFound
  | ObjectWriteConflict

function isAliasReplacement(
  update: ObjectAliasUpdate
): update is ReadonlyArray<ObjectAliasType> {
  return Array.isArray(update)
}

function sortedAliases(
  aliases: ReadonlyArray<ObjectAliasType>
): ReadonlyArray<ObjectAliasType> {
  // This array is a fresh snapshot owned by the in-memory test adapter.
  // oxlint-disable-next-line unicorn/no-array-sort
  return [...aliases].sort()
}

function makeRepository(): Repository<typeof Account, RepositoryError> {
  const aliasOwners = new Map<ObjectAliasType, string>()
  const records = new Map<string, AccountRecord>()

  const claimAliases = (
    id: RecordId<"account">,
    aliases: ReadonlyArray<ObjectAliasType>
  ) => {
    const conflict = aliases
      .map((alias) => ({ alias, owner: aliasOwners.get(alias) }))
      .find(({ owner }) => owner !== undefined && owner !== id)
    if (conflict?.owner !== undefined) {
      return Effect.fail(
        new ObjectAliasConflict({
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
    aliases: ReadonlyArray<ObjectAliasType>
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
          (record, index) => record.etag !== targets[index]?.expectedEtag
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
    delete: (id, expectedEtag) =>
      get(id).pipe(
        Effect.flatMap((record) =>
          record.etag !== expectedEtag
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
          email: record.email ?? null,
          status: record.status ?? "active",
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
    update: (id, input, expectedEtag, metadata) =>
      get(id).pipe(
        Effect.flatMap((record) =>
          Effect.gen(function* () {
            if (record.etag !== expectedEtag) {
              return yield* Effect.fail(
                new ObjectWriteConflict({
                  objectType: Account.id,
                  recordId: id,
                })
              )
            }
            const { aliases, ...changes } = input
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
              ...metadata,
              aliases: updatedAliases,
            }
            records.set(id, updated)
            return updated
          })
        )
      ),
  }
}

describe("ObjectService", () => {
  it("provides validated CRUD, atomic batching, pagination, and optimistic writes", async () => {
    let nextId = 0
    const authorizationRequests: Array<ObjectService.AuthorizationRequest> = []
    const repository = makeRepository()
    const context = {
      actorId: ActorId("user_1"),
      rootId: RootId("root_1"),
    }
    const service = ObjectService.make(Account, repository, {
      authorize: (request) => {
        authorizationRequests.push(request)
        return Effect.succeed(context)
      },
      generateEtag: () => `etag_${nextId}`,
      generateId: () => `account_${++nextId}`,
    })

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const hubspotAcme = ObjectAlias("hubspot:portal_1:company:acme")
        const hubspotBravo = ObjectAlias("hubspot:portal_1:company:bravo")
        const salesforceAcme = ObjectAlias("salesforce:org_1:account:acme")
        const legacyAcme = ObjectAlias("legacy:company:acme")
        const invalidCreate = yield* service
          .create({ name: "", slug: "invalid" })
          .pipe(Effect.flip)
        const first = yield* service.create({
          aliases: [hubspotAcme],
          name: "Acme",
          slug: "acme",
        })
        const second = yield* service.create({
          aliases: [hubspotBravo],
          name: "Bravo",
          slug: "bravo",
        })
        const updated = yield* service.update({
          id: first.id,
          name: "Acme Corporation",
        })
        const invalidUpdate = yield* service
          .update({ id: first.id, name: "" })
          .pipe(Effect.flip)
        const batch = yield* service.batchGet({ ids: [second.id, first.id] })
        const firstPage = yield* service.list({ pageSize: 1 })
        if (firstPage.nextPageToken === "") {
          return yield* Effect.die("Expected another page")
        }
        const secondPage = yield* service.list({
          pageSize: 1,
          pageToken: firstPage.nextPageToken,
        })
        const staleWrite = yield* repository
          .update(first.id, { name: "Stale" }, first.etag, {
            etag: updated.etag,
            updatedAt: updated.updatedAt,
            updatedById: context.actorId,
          })
          .pipe(Effect.flip)
        const immutableWrite = yield* service
          .update({ id: first.id, slug: "different" })
          .pipe(Effect.flip)
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
        const duplicateAliasUpdate = yield* service
          .update({ aliases: [legacyAcme, legacyAcme], id: first.id })
          .pipe(Effect.flip)
        const overlappingAliasUpdate = yield* service
          .update({
            aliases: { add: [legacyAcme], remove: [legacyAcme] },
            id: first.id,
          })
          .pipe(Effect.flip)
        const third = yield* service.create({
          name: "Charlie",
          slug: "charlie",
        })
        const fourth = yield* service.create({ name: "Delta", slug: "delta" })
        const duplicateBatchDelete = yield* service
          .batchDelete({ ids: [third.id, third.id] })
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
          aliasDelta,
          aliasReplacement,
          batch,
          deleted,
          duplicateBatchDelete,
          duplicateAliasUpdate,
          emptyBatchDelete,
          first,
          firstPage,
          invalidCreate,
          invalidUpdate,
          immutableWrite,
          oversizedBatchDelete,
          overlappingAliasUpdate,
          second,
          secondPage,
          staleWrite,
          updated,
        }
      })
    )

    expect(result.first).toMatchObject({
      aliases: ["hubspot:portal_1:company:acme"],
      email: null,
      id: "account_1",
      name: "Acme",
      parentId: "root_1",
      slug: "acme",
      status: "active",
    })
    expect(result.updated).toMatchObject({
      id: result.first.id,
      name: "Acme Corporation",
      slug: "acme",
    })
    expect(result.invalidCreate).toBeInstanceOf(Schema.SchemaError)
    expect(result.invalidUpdate).toBeInstanceOf(Schema.SchemaError)
    expect(result.aliasDelta.aliases).toEqual(["salesforce:org_1:account:acme"])
    expect(result.aliasReplacement.aliases).toEqual(["legacy:company:acme"])
    expect(result.aliasConflict).toBeInstanceOf(ObjectAliasConflict)
    expect(result.duplicateAliasUpdate).toBeInstanceOf(Schema.SchemaError)
    expect(result.overlappingAliasUpdate).toBeInstanceOf(Schema.SchemaError)
    expect(result.batch.items.map(({ id }) => id)).toEqual([
      result.second.id,
      result.first.id,
    ])
    expect(result.firstPage.nextPageToken).not.toBe("")
    expect(result.secondPage.nextPageToken).toBe("")
    expect(result.staleWrite).toBeInstanceOf(ObjectWriteConflict)
    expect(result.immutableWrite).toBeInstanceOf(
      ObjectService.ImmutablePropertyError
    )
    expect(result.duplicateBatchDelete).toBeInstanceOf(
      ObjectService.InvalidBatchDeleteRequest
    )
    expect(result.emptyBatchDelete).toBeInstanceOf(
      ObjectService.InvalidBatchDeleteRequest
    )
    expect(result.oversizedBatchDelete).toBeInstanceOf(
      ObjectService.InvalidBatchDeleteRequest
    )
    expect(result.deleted).toBeInstanceOf(ObjectNotFound)
    expect(authorizationRequests[0]).toEqual({
      objectType: "account",
      operation: "create",
    })
    expect(authorizationRequests.at(-1)).toEqual({
      objectType: "account",
      operation: "batchDelete",
      recordIds: ["account_3", "account_4"],
    })
  })
})
