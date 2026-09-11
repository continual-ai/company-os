import { Context, Data, Effect, Layer } from "effect"

import { resolveListRequest } from "#/runtime/contract/object-input.ts"
import { type ModelLinkTraversal } from "#/runtime/model/definition/model.ts"
import type {
  ObjectRecord,
  ObjectRef,
} from "#/runtime/model/definition/object.ts"
import {
  normalizePageSize,
  RecordId,
  type ObjectType,
  type RecordIdentifier,
} from "#/runtime/model/index.ts"
import type { LinkListInput } from "#/runtime/model/link-input.ts"
import { requireProjectAccess } from "#/runtime/server/auth/project-access.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import {
  makeLinkWrites,
  type InitialLinks,
  type LinkUpdates,
} from "#/runtime/server/model/link-writes.ts"
import { ObjectRepositories } from "#/runtime/server/model/object-repositories.ts"
import { RecordIdentifierResolver } from "#/runtime/server/model/record-identifier-resolver.ts"
import { PageTokens } from "#/runtime/server/page-tokens.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import { makeLinkRepository } from "#/runtime/server/storage/link-repository.ts"

class InvalidLinkRequest extends Data.TaggedError("InvalidLinkRequest")<{
  readonly message: string
  readonly path: ReadonlyArray<string>
}> {}

function withType(
  object: ObjectType,
  page: ReadonlyArray<ObjectRecord<ObjectType>>
): ReadonlyArray<ObjectRecord<ObjectType> & ObjectRef> {
  return page.map((record) => ({ ...record, objectType: object.id }))
}

const make = Effect.gen(function* () {
  const { model: Model, storage: Storage } = yield* ModelContext
  const database = yield* Database
  const identifiers = yield* RecordIdentifierResolver
  const pageTokens = yield* PageTokens
  const records = yield* ObjectRepositories
  const repository = makeLinkRepository(Storage, database, pageTokens)
  const { link, unlink, initialize, update } = yield* makeLinkWrites
  const list = Effect.fn("@company/Links.list")(function* (
    traversal: ModelLinkTraversal,
    input: LinkListInput
  ) {
    yield* requireProjectAccess
    const pageSize = yield* Effect.try({
      try: () => normalizePageSize(input.pageSize),
      catch: () =>
        new InvalidLinkRequest({
          message: "pageSize must be a non-negative integer.",
          path: ["pageSize"],
        }),
    })
    const sourceId = yield* identifiers.resolve(traversal.source.id, input.id)
    yield* records
      .get(traversal.source)
      .get(RecordId(traversal.source.id)(sourceId))
    const target = Object.values(Model.objects).find(
      (object) => object.id === traversal.target.from.typeId
    )
    if (!target && (input.filter !== undefined || input.sort !== undefined))
      return yield* Effect.fail(
        new InvalidLinkRequest({
          message: "Filtering and sorting require a concrete target object.",
          path: [input.filter === undefined ? "sort" : "filter"],
        })
      )
    const query = target
      ? yield* resolveListRequest(target, input, identifiers.resolveAliases)
      : input.pageToken === undefined
        ? {}
        : { pageToken: input.pageToken }
    const relatedTo = {
      direction: traversal.direction,
      linkId: traversal.link.id,
      sourceId,
    }
    if (target) {
      const page = yield* records
        .get(target)
        .list({ ...query, pageSize, relatedTo })
      return { ...page, items: withType(target, page.items) }
    }
    const page = yield* repository.list({
      ...relatedTo,
      pageSize,
      ...(input.pageToken === undefined ? {} : { pageToken: input.pageToken }),
    })
    const batches = yield* Effect.forEach(
      [...new Set(page.items.map((item) => item.objectType))],
      (typeId) =>
        Effect.gen(function* () {
          const object = Model.objects[typeId]
          if (!object)
            return yield* Effect.die(`Unknown related object '${typeId}'.`)
          const ids = page.items
            .filter((item) => item.objectType === typeId)
            .map((item) => item.id)
          const related = yield* records.get(object).list({
            pageSize: ids.length,
            filter: { field: "id", operator: "in", value: ids },
          })
          return withType(object, related.items)
        }),
      { concurrency: "unbounded" }
    )
    const byId = new Map(batches.flat().map((record) => [record.id, record]))
    return {
      ...page,
      items: page.items.flatMap(({ id }) => {
        const record = byId.get(id)
        return record ? [record] : []
      }),
    }
  })

  return {
    link: (...args: Parameters<typeof link>) =>
      requireProjectAccess.pipe(Effect.andThen(link(...args))),
    unlink: (...args: Parameters<typeof unlink>) =>
      requireProjectAccess.pipe(Effect.andThen(unlink(...args))),
    initialize: (...args: Parameters<typeof initialize>) =>
      requireProjectAccess.pipe(Effect.andThen(initialize(...args))),
    update: (...args: Parameters<typeof update>) =>
      requireProjectAccess.pipe(Effect.andThen(update(...args))),
    list,
    /**
     * Validated Link writes for custom Actions that already established authority.
     * They use the same endpoint validation, locking, and event journal as public traversals.
     */
    writer: (object: ObjectType) => ({
      initialize: (sourceId: string, initial: InitialLinks) =>
        initialize(object, sourceId, initial, true),
      update: (sourceId: RecordIdentifier, changes: LinkUpdates) =>
        update(object, sourceId, changes, true),
    }),
  }
})

/** Governed execution for every model-derived Link traversal. */
export class Links extends Context.Service<Links>()("@company/Links", {
  make,
}) {
  static readonly layer = Layer.effect(this, this.make)
}
