import { Context, Data, Effect, Layer } from "effect"

import { resolveListRequest } from "#/runtime/contract/object-input.ts"
import {
  type ModelLinkTraversal,
  modelObjectLinkTraversals,
} from "#/runtime/model/definition/model.ts"
import type {
  ObjectRecord,
  ObjectRef,
} from "#/runtime/model/definition/object.ts"
import {
  normalizePageSize,
  modelTypeAccepts,
  RecordId,
  type ObjectType,
  type RecordIdentifier,
} from "#/runtime/model/index.ts"
import type {
  LinkListInput,
  LinkMutationInput,
} from "#/runtime/model/link-input.ts"
import { requireProjectAccess } from "#/runtime/server/auth/project-access.ts"
import { makeEventWriter } from "#/runtime/server/events/event-writer.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { ObjectRepositories } from "#/runtime/server/model/object-repositories.ts"
import { RecordIdentifierResolver } from "#/runtime/server/model/record-identifier-resolver.ts"
import { PageTokens } from "#/runtime/server/page-tokens.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import {
  makeLinkRepository,
  type LinkPair,
} from "#/runtime/server/storage/link-repository.ts"
import { ObjectNotFound } from "#/runtime/server/storage/object-repository.ts"
import {
  inValues,
  projection,
  type SelectionRow,
} from "#/runtime/server/storage/statement.ts"

class LinkMutationNotAllowed extends Data.TaggedError(
  "LinkMutationNotAllowed"
)<{
  readonly linkId: string
  readonly traversal: string
}> {}

class InvalidLinkRequest extends Data.TaggedError("InvalidLinkRequest")<{
  readonly message: string
  readonly path: ReadonlyArray<string>
}> {}

class RequiredLinkMissing extends Data.TaggedError("RequiredLinkMissing")<{
  readonly objectType: string
  readonly traversal: string
}> {}

class RequiredLinkUnlink extends Data.TaggedError("RequiredLinkUnlink")<{
  readonly linkId: string
  readonly traversal: string
}> {}

/** Targets per traversal key supplied when a record is created. */
type InitialLinks = Readonly<
  Record<
    string,
    RecordIdentifier | ReadonlyArray<RecordIdentifier> | null | undefined
  >
>

interface LinkChanges {
  readonly add?: ReadonlyArray<RecordIdentifier>
  readonly remove?: ReadonlyArray<RecordIdentifier>
}

/** Added and removed targets per traversal key supplied when a record is updated. */
type LinkUpdates = Readonly<Record<string, LinkChanges | undefined>>

function withType(
  object: ObjectType,
  page: ReadonlyArray<ObjectRecord<ObjectType>>
): ReadonlyArray<ObjectRecord<ObjectType> & ObjectRef> {
  return page.map((record) => ({ ...record, objectType: object.id }))
}

function isIdentifierList(
  value: RecordIdentifier | ReadonlyArray<RecordIdentifier>
): value is ReadonlyArray<RecordIdentifier> {
  return Array.isArray(value)
}

function targets(
  value: RecordIdentifier | ReadonlyArray<RecordIdentifier> | null | undefined
): ReadonlyArray<RecordIdentifier> {
  if (value === undefined || value === null) return []
  return isIdentifierList(value) ? value : [value]
}

const make = Effect.gen(function* () {
  const context = yield* ModelContext
  const { model: Model, storage: Storage } = context
  const database = yield* Database
  const sql = database.sql
  const identifiers = yield* RecordIdentifierResolver
  const pageTokens = yield* PageTokens
  const records = yield* ObjectRepositories
  const repository = makeLinkRepository(Storage, database, pageTokens)
  const events = makeEventWriter(database, context)
  const objects = Storage.core.objects

  /** Locks both endpoints, mutates the edge set, and journals exactly the edges that changed. */
  const mutate = (
    traversal: ModelLinkTraversal,
    pair: LinkPair,
    operation: "link" | "unlink"
  ) =>
    database.transaction(() =>
      Effect.gen(function* () {
        const ids = [pair.sourceId, pair.targetId].sort()
        const selection = {
          id: objects.columns.id,
          objectType: objects.columns.objectType,
        }
        const locked = yield* sql<
          SelectionRow<typeof selection>
        >`select ${projection(selection)}
          from ${objects}
          where ${inValues(sql, objects.columns.id, ids)}
          order by ${sql.csv([objects.columns.id])} for update`
        for (const [id, objectType] of [
          [pair.sourceId, traversal.source.id],
          [pair.targetId, traversal.target.from.typeId],
        ] as const) {
          if (
            !locked.some(
              (record) =>
                record.id === id &&
                modelTypeAccepts(Model, record.objectType, objectType)
            )
          )
            return yield* Effect.fail(
              new ObjectNotFound({ objectType, recordId: id })
            )
        }
        const changes = yield* repository[operation](pair)
        for (const change of changes)
          yield* events.record({
            type: `${change.linkId}.${change.kind}`,
            subjects: yield* events.subjects([
              change.forwardId,
              change.reverseId,
            ]),
            data: { link: change.linkId },
          })
        return undefined
      })
    )

  const resolvePair = Effect.fn("@company/Links.resolvePair")(function* (
    traversal: ModelLinkTraversal,
    input: LinkMutationInput
  ) {
    const sourceId = yield* identifiers.resolve(traversal.source.id, input.id)
    const targetId = yield* identifiers.resolve(
      traversal.target.from.typeId,
      input.target
    )
    return {
      direction: traversal.direction,
      linkId: traversal.link.id,
      sourceId,
      targetId,
    } satisfies LinkPair
  })

  const link = Effect.fn("@company/Links.link")(function* (
    traversal: ModelLinkTraversal,
    input: LinkMutationInput
  ) {
    if (!traversal.writable) {
      return yield* Effect.fail(
        new LinkMutationNotAllowed({
          linkId: traversal.link.id,
          traversal: traversal.traversal.key,
        })
      )
    }
    const pair = yield* resolvePair(traversal, input)
    yield* mutate(traversal, pair, "link")
    return undefined
  })

  const unlink = Effect.fn("@company/Links.unlink")(function* (
    traversal: ModelLinkTraversal,
    input: LinkMutationInput
  ) {
    if (!traversal.writable) {
      return yield* Effect.fail(
        new LinkMutationNotAllowed({
          linkId: traversal.link.id,
          traversal: traversal.traversal.key,
        })
      )
    }
    if (
      traversal.traversal.cardinality === "one" ||
      traversal.target.cardinality === "one"
    ) {
      return yield* Effect.fail(
        new RequiredLinkUnlink({
          linkId: traversal.link.id,
          traversal: traversal.traversal.key,
        })
      )
    }
    const pair = yield* resolvePair(traversal, input)
    yield* mutate(traversal, pair, "unlink")
    return undefined
  })

  const initialize = Effect.fn("@company/Links.initialize")(
    function* (object: ObjectType, sourceId: string, initial: InitialLinks) {
      const traversals = modelObjectLinkTraversals(Model, object)
      const known = new Set(traversals.map(({ traversal }) => traversal.key))
      const unknown = Object.keys(initial).find((key) => !known.has(key))
      if (unknown !== undefined) {
        return yield* Effect.fail(
          new InvalidLinkRequest({
            message: `Link traversal '${unknown}' is not defined for '${object.id}'.`,
            path: ["links", unknown],
          })
        )
      }
      for (const traversal of traversals) {
        const requested = targets(initial[traversal.traversal.key])
        if (
          traversal.traversal.cardinality !== "many" &&
          requested.length > 1
        ) {
          return yield* Effect.fail(
            new InvalidLinkRequest({
              message: "A singular Link accepts at most one target.",
              path: ["links", traversal.traversal.key],
            })
          )
        }
        if (
          traversal.traversal.cardinality === "one" &&
          requested.length === 0
        ) {
          return yield* Effect.fail(
            new RequiredLinkMissing({
              objectType: object.id,
              traversal: traversal.traversal.key,
            })
          )
        }
        for (const target of requested) {
          const targetId = yield* identifiers.resolve(
            traversal.target.from.typeId,
            target
          )
          yield* mutate(
            traversal,
            {
              direction: traversal.direction,
              linkId: traversal.link.id,
              sourceId,
              targetId,
            },
            "link"
          )
        }
      }
      return undefined
    },
    (effect) => database.transaction(() => effect)
  )

  const update = Effect.fn("@company/Links.update")(
    function* (
      object: ObjectType,
      sourceId: RecordIdentifier,
      changes: LinkUpdates
    ) {
      const traversals = modelObjectLinkTraversals(Model, object).filter(
        ({ writable }) => writable
      )
      const known = new Set(traversals.map(({ traversal }) => traversal.key))
      const unknown = Object.keys(changes).find((key) => !known.has(key))
      if (unknown !== undefined) {
        return yield* Effect.fail(
          new InvalidLinkRequest({
            message: `Link traversal '${unknown}' is not writable for '${object.id}'.`,
            path: ["links", unknown],
          })
        )
      }
      for (const traversal of traversals) {
        const key = traversal.traversal.key
        const change = changes[key]
        if (change === undefined) continue
        const add: ReadonlyArray<RecordIdentifier> = change.add ?? []
        const remove: ReadonlyArray<RecordIdentifier> = change.remove ?? []
        if (traversal.traversal.cardinality !== "many" && add.length > 1) {
          return yield* Effect.fail(
            new InvalidLinkRequest({
              message: "A singular Link accepts at most one added target.",
              path: ["links", key, "add"],
            })
          )
        }
        if (
          remove.length > 0 &&
          (traversal.traversal.cardinality === "one" ||
            traversal.target.cardinality === "one")
        ) {
          return yield* Effect.fail(
            new RequiredLinkUnlink({
              linkId: traversal.link.id,
              traversal: key,
            })
          )
        }
        const added = new Set(add)
        const duplicate = remove.find((target) => added.has(target))
        if (duplicate !== undefined) {
          return yield* Effect.fail(
            new InvalidLinkRequest({
              message: "A Link target cannot be both added and removed.",
              path: ["links", key],
            })
          )
        }
        for (const target of remove)
          yield* unlink(traversal, { id: sourceId, target })
        for (const target of add)
          yield* link(traversal, { id: sourceId, target })
      }
      return undefined
    },
    (effect) => database.transaction(() => effect)
  )

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
        initialize(object, sourceId, initial),
      update: (sourceId: RecordIdentifier, changes: LinkUpdates) =>
        update(object, sourceId, changes),
    }),
  }
})

/** Governed execution for every model-derived Link traversal. */
export class Links extends Context.Service<Links>()("@company/Links", {
  make,
}) {
  static readonly layer = Layer.effect(this, this.make)
}
