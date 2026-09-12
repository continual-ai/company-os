import { Data, Effect } from "effect"

import {
  type ModelLinkTraversal,
  modelObjectLinkTraversals,
} from "#/runtime/model/definition/model.ts"
import {
  modelTypeAccepts,
  RecordId,
  type ObjectType,
  type RecordIdentifier,
} from "#/runtime/model/index.ts"
import type { LinkMutationInput } from "#/runtime/model/link-input.ts"
import { makeEventWriter } from "#/runtime/server/events/event-writer.ts"
import { currentActorId } from "#/runtime/server/invocation-context.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { RecordIdentifierResolver } from "#/runtime/server/model/record-identifier-resolver.ts"
import { requireWritableOperation } from "#/runtime/server/operation-mode.ts"
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

/** Targets per traversal key supplied when a record is created. */
export type InitialLinks = Readonly<
  Record<string, ReadonlyArray<RecordIdentifier> | undefined>
>

interface LinkChanges {
  readonly add?: ReadonlyArray<RecordIdentifier>
  readonly remove?: ReadonlyArray<RecordIdentifier>
  readonly replace?: ReadonlyArray<RecordIdentifier>
}

/** Added and removed targets per traversal key supplied when a record is updated. */
export type LinkUpdates = Readonly<Record<string, LinkChanges | undefined>>

export const makeLinkWrites = Effect.gen(function* () {
  const context = yield* ModelContext
  const { model: Model, storage: Storage } = context
  const database = yield* Database
  const sql = database.sql
  const identifiers = yield* RecordIdentifierResolver
  const pageTokens = yield* PageTokens
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
        yield* requireWritableOperation
        yield* sql`select pg_advisory_xact_lock(hashtextextended(${`link:${traversal.link.id}`}, 0))`
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
        if (changes.length > 0) {
          const actor = yield* currentActorId
          yield* sql`update ${objects} set etag = (etag::numeric + 1)::text, updated_at = now(), updated_by_id = ${actor} where ${inValues(sql, objects.columns.id, ids)}`
        }
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
    const pair = yield* resolvePair(traversal, input)
    yield* mutate(traversal, pair, "unlink")
    return undefined
  })

  const initialize = Effect.fn("@company/Links.initialize")(
    function* (
      object: ObjectType,
      sourceId: string,
      initial: InitialLinks,
      trusted = false
    ) {
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
        const requested = initial[traversal.traversal.key] ?? []
        if (!trusted && !traversal.writable && requested.length > 0)
          return yield* Effect.fail(
            new LinkMutationNotAllowed({
              linkId: traversal.link.id,
              traversal: traversal.traversal.key,
            })
          )
        if (traversal.traversal.max === 1 && requested.length > 1) {
          return yield* Effect.fail(
            new InvalidLinkRequest({
              message: "A singular Link accepts at most one target.",
              path: ["links", traversal.traversal.key],
            })
          )
        }
        if (traversal.traversal.min > 0 && requested.length === 0) {
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
      changes: LinkUpdates,
      trusted = false
    ) {
      const traversals = modelObjectLinkTraversals(Model, object).filter(
        ({ writable }) => trusted || writable
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
        if (
          change.replace !== undefined &&
          (change.add !== undefined || change.remove !== undefined)
        )
          return yield* Effect.fail(
            new InvalidLinkRequest({
              message: "Replace cannot be combined with add or remove.",
              path: ["links", key],
            })
          )
        const resolvedSource = yield* identifiers.resolve(object.id, sourceId)
        // Lock a relationship before reading its current set for replacement.
        yield* requireWritableOperation
        yield* sql`select pg_advisory_xact_lock(hashtextextended(${`link:${traversal.link.id}`}, 0))`
        const current =
          change.replace === undefined
            ? []
            : yield* repository.ids({
                linkId: traversal.link.id,
                direction: traversal.direction,
                sourceId: resolvedSource,
              })
        const replacement =
          change.replace === undefined
            ? undefined
            : yield* Effect.forEach(change.replace, (id) =>
                identifiers.resolve(traversal.target.from.typeId, id)
              )
        const add: ReadonlyArray<RecordIdentifier> =
          replacement === undefined
            ? (change.add ?? [])
            : replacement
                .filter((id) => !current.includes(id))
                .map(RecordId(traversal.target.from.typeId))
        const remove: ReadonlyArray<RecordIdentifier> =
          replacement === undefined
            ? (change.remove ?? [])
            : current
                .filter((id) => !new Set<string>(replacement).has(id))
                .map(RecordId(traversal.target.from.typeId))
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
          yield* mutate(
            traversal,
            yield* resolvePair(traversal, { id: sourceId, target }),
            "unlink"
          )
        for (const target of add)
          yield* mutate(
            traversal,
            yield* resolvePair(traversal, { id: sourceId, target }),
            "link"
          )
      }
      return undefined
    },
    (effect) => database.transaction(() => effect)
  )

  return { link, unlink, initialize, update }
})
