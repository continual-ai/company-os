import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import { ActorId, defineObject, type ObjectRecord } from "./definition/object"
import { DEFAULT_PAGE_SIZE, PageToken } from "./definition/request"
import { Root } from "./definition/root"
import { RecordId, schema } from "./definition/schema"
import {
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
    email: schema.email(),
    name: schema.string({ required: true, minLength: 1 }),
    slug: schema.string({ immutable: true, required: true }),
    status: schema.select({
      defaultValue: "active",
      options: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
      ],
    }),
  },
  display: { status: "status", title: "name" },
})

type AccountRecord = ObjectRecord<typeof Account>
type RepositoryError = ObjectNotFound | ObjectWriteConflict

function makeRepository(): Repository<typeof Account, RepositoryError> {
  const records = new Map<string, AccountRecord>()

  const get = (
    id: RecordId<"account">
  ): Effect.Effect<AccountRecord, ObjectNotFound> => {
    const record = records.get(id)
    if (record === undefined) {
      return Effect.fail(
        new ObjectNotFound({ objectId: Account.id, recordId: id })
      )
    }
    return Effect.succeed(record)
  }

  return {
    batchGet: (ids) => Effect.forEach(ids, get),
    delete: (id, expectedEtag) =>
      get(id).pipe(
        Effect.flatMap((record) =>
          record.etag !== expectedEtag
            ? Effect.fail(
                new ObjectWriteConflict({
                  objectId: Account.id,
                  recordId: id,
                })
              )
            : Effect.sync(() => {
                records.delete(id)
              })
        )
      ),
    get,
    insert: (record) =>
      Effect.sync(() => {
        const hydrated: AccountRecord = {
          ...record,
          email: record.email ?? "",
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
        Effect.flatMap((record) => {
          if (record.etag !== expectedEtag) {
            return Effect.fail(
              new ObjectWriteConflict({
                objectId: Account.id,
                recordId: id,
              })
            )
          }
          const updated: AccountRecord = { ...record, ...input, ...metadata }
          records.set(id, updated)
          return Effect.succeed(updated)
        })
      ),
  }
}

describe("ObjectService", () => {
  it("provides validated CRUD, stable batching, pagination, and optimistic writes", async () => {
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
        const first = yield* service.create({ name: "Acme", slug: "acme" })
        const second = yield* service.create({
          name: "Bravo",
          slug: "bravo",
        })
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

        return {
          batch,
          first,
          firstPage,
          immutableWrite,
          second,
          secondPage,
          staleWrite,
          updated,
        }
      })
    )

    expect(result.first).toMatchObject({
      email: "",
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
    expect(authorizationRequests[0]).toEqual({
      objectId: "account",
      operation: "create",
    })
  })
})
