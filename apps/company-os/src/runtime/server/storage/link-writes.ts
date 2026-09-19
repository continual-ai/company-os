import { Effect } from "effect"

import {
  type ModelLinkTraversal,
  modelObjectLinkTraversals,
} from "#/runtime/model/definition/model.ts"
import {
  modelTypeAccepts,
  type ObjectType,
  type RecordIdentifier,
} from "#/runtime/model/index.ts"
import type { LinkMutationInput } from "#/runtime/model/link-input.ts"
import { mergeControllerKeys } from "#/runtime/server/controllers/routing.ts"
import {
  ObjectNotFound,
  ObjectWriteConflict,
  LinkMutationNotAllowed,
  InvalidLinkRequest,
  RequiredLinkMissing,
} from "#/runtime/server/errors.ts"
import { makeEventWriter } from "#/runtime/server/events/event-writer.ts"
import { currentActorId } from "#/runtime/server/invocation-context.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { requireWritableOperation } from "#/runtime/server/operation-mode.ts"
import { RecordIdentifiers } from "#/runtime/server/storage/identifiers.ts"
import {
  linkPairEndpoints,
  makeLinkRepository,
  type LinkPair,
} from "#/runtime/server/storage/link-repository.ts"
import { linkStorage } from "#/runtime/server/storage/link-storage.ts"
import {
  inValues,
  projection,
  type SelectionRow,
} from "#/runtime/server/storage/statement.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"

/** Targets per traversal key supplied when a record is created. */
export type InitialLinks = Readonly<
  Record<
    string,
    RecordIdentifier | null | ReadonlyArray<RecordIdentifier> | undefined
  >
>

interface LinkChanges {
  readonly add?: ReadonlyArray<RecordIdentifier>
  readonly remove?: ReadonlyArray<RecordIdentifier>
}

/** Added and removed targets per traversal key supplied when a record is updated. */
export type LinkUpdates = Readonly<
  Record<
    string,
    | RecordIdentifier
    | null
    | ReadonlyArray<RecordIdentifier>
    | LinkChanges
    | undefined
  >
>

interface EdgeMutation {
  readonly traversal: ModelLinkTraversal
  readonly pair: LinkPair
  readonly operation: "link" | "unlink"
}

const edgeKey = (edge: {
  readonly linkId: string
  readonly forwardId: string
  readonly reverseId: string
}) => JSON.stringify([edge.linkId, edge.forwardId, edge.reverseId])

export const makeLinkWrites = Effect.gen(function* () {
  const context = yield* ModelContext
  const { model, storage } = context
  const database = yield* SqlDatabase
  const { sql } = database
  const identifiers = yield* RecordIdentifiers
  const repository = makeLinkRepository(storage, database)
  const events = makeEventWriter(database, context)
  const objects = storage.core.objects

  const pairFor = Effect.fn("@company/Links.resolvePair")(function* (
    traversal: ModelLinkTraversal,
    sourceId: string,
    target: RecordIdentifier
  ) {
    return {
      direction: traversal.direction,
      linkId: traversal.link.id,
      sourceId,
      targetId: yield* identifiers.resolve(
        traversal.target.from.typeId,
        target
      ),
    } satisfies LinkPair
  })
  const lock = Effect.fn("@company/Links.lock")(function* (
    source: {
      objectType: string
      id: string
      etag?: string
      creating?: boolean
    },
    plan: ReadonlyArray<EdgeMutation>
  ) {
    yield* requireWritableOperation
    const ids = [
      ...new Set([
        ...(source.creating ? [] : [source.id]),
        ...plan.map(({ pair }) => pair.targetId),
      ]),
    ].sort()
    const selection = {
      id: objects.columns.id,
      objectType: objects.columns.objectType,
      etag: objects.columns.etag,
    }
    const locked = yield* sql<
      SelectionRow<typeof selection>
    >`select ${projection(selection)} from ${objects} where ${inValues(sql, objects.columns.id, ids)} order by ${objects.columns.id} for update`
    const records = new Map(locked.map((record) => [record.id, record]))
    const expected = [
      ...(source.creating ? [] : [{ id: source.id, type: source.objectType }]),
      ...plan.map(({ pair, traversal }) => ({
        id: pair.targetId,
        type: traversal.target.from.typeId,
      })),
    ]
    for (const { id, type } of expected) {
      const record = records.get(id)
      if (!record || !modelTypeAccepts(model, record.objectType, type))
        return yield* Effect.fail(
          new ObjectNotFound({ objectType: type, recordId: id })
        )
    }
    if (
      source.etag !== undefined &&
      records.get(source.id)?.etag !== source.etag
    )
      return yield* Effect.fail(
        new ObjectWriteConflict({
          objectType: source.objectType,
          recordId: source.id,
        })
      )
    return undefined
  })

  const apply = Effect.fn("@company/Links.apply")(function* (
    plan: ReadonlyArray<EdgeMutation>,
    attributedId?: string,
    inserted: ReadonlyArray<EdgeMutation> = []
  ) {
    const before = new Map(
      yield* Effect.forEach(plan, ({ pair }) =>
        Effect.gen(function* () {
          const edge = { linkId: pair.linkId, ...linkPairEndpoints(pair) }
          return [edgeKey(edge), yield* events.linkTargets(edge)] as const
        })
      )
    )
    const insertedSet = new Set(inserted)
    const changes = [
      ...inserted.map(({ pair }) => ({
        ...linkPairEndpoints(pair),
        linkId: pair.linkId,
        kind: "linked" as const,
      })),
      ...(yield* repository.apply(
        plan
          .filter((edge) => !insertedSet.has(edge))
          .map(({ pair, operation }) => ({ ...pair, operation }))
      )),
    ]
    const ids = [
      ...new Set(
        changes.flatMap((change) => [change.forwardId, change.reverseId])
      ),
    ]
    const toAttribute = ids.filter((id) => id !== attributedId)
    if (toAttribute.length > 0) {
      const actor = yield* currentActorId
      yield* sql`update ${objects} set etag = (etag::numeric + 1)::text, updated_at = now(), updated_by_id = ${actor} where ${inValues(sql, objects.columns.id, toAttribute)}`
    }
    const subjects = yield* events.subjects(ids)
    for (const change of changes)
      yield* events.record({
        type: `${change.linkId}.${change.kind}`,
        subjects: subjects.filter(
          ({ id }) => id === change.forwardId || id === change.reverseId
        ),
        data: { link: change.linkId },
        controllerKeys: mergeControllerKeys(
          before.get(edgeKey(change))!,
          yield* events.linkTargets(change)
        ),
      })
  })

  /** Resolve complete replacements before locking; revalidate after locking to avoid acquiring new locks out of order. */
  const prepare = Effect.fn("@company/Links.prepare")(function* (
    object: ObjectType,
    sourceId: RecordIdentifier,
    changes: LinkUpdates,
    creating = false
  ) {
    const source = yield* identifiers.resolve(object.id, sourceId)
    const traversals = modelObjectLinkTraversals(model, object)
    if (creating)
      for (const { traversal } of traversals)
        if (traversal.min === 1 && typeof changes[traversal.key] !== "string")
          return yield* Effect.fail(
            new RequiredLinkMissing({
              objectType: object.id,
              traversal: traversal.key,
            })
          )
    const known = new Map(
      traversals.map((traversal) => [traversal.traversal.key, traversal])
    )
    const plan: EdgeMutation[] = []
    const replacements: Array<{
      pair: Omit<LinkPair, "targetId">
      ids: ReadonlyArray<string>
    }> = []
    for (const [key, change] of Object.entries(changes)) {
      if (change === undefined) continue
      const traversal = known.get(key)
      if (!traversal)
        return yield* Effect.fail(
          new InvalidLinkRequest({
            message: `Relationship '${object.id}.${key}' is not writable.`,
            path: ["links", key],
          })
        )
      if (
        traversal.traversal.max === 1
          ? typeof change !== "string" && change !== null
          : typeof change === "string" || change === null
      )
        return yield* Effect.fail(
          new InvalidLinkRequest({
            message:
              "Use an ID or null for singular relationships; an array or add/remove delta for plural relationships.",
            path: ["links", key],
          })
        )
      const replacement =
        change === null
          ? []
          : typeof change === "string"
            ? [change]
            : Array.isArray(change)
              ? change
              : undefined
      const delta: LinkChanges =
        typeof change === "object" &&
        change !== null &&
        ("add" in change || "remove" in change)
          ? change
          : {}
      const base = {
        linkId: traversal.link.id,
        direction: traversal.direction,
        sourceId: source,
      }
      const current =
        creating || replacement === undefined ? [] : yield* repository.ids(base)
      if (!creating && replacement !== undefined)
        replacements.push({ pair: base, ids: current })
      const requested =
        replacement === undefined
          ? undefined
          : yield* Effect.forEach(replacement, (id) =>
              identifiers.resolve(traversal.target.from.typeId, id)
            )
      const add =
        requested === undefined
          ? yield* Effect.forEach(delta.add ?? [], (id) =>
              identifiers.resolve(traversal.target.from.typeId, id)
            )
          : requested.filter((id) => !current.includes(id))
      const remove =
        requested === undefined
          ? yield* Effect.forEach(delta.remove ?? [], (id) =>
              identifiers.resolve(traversal.target.from.typeId, id)
            )
          : current.filter((id) => !new Set<string>(requested).has(id))
      if (add.some((id) => remove.includes(id)))
        return yield* Effect.fail(
          new InvalidLinkRequest({
            message: "A target cannot be both added and removed.",
            path: ["links", key],
          })
        )
      for (const [operation, targets] of [
        ["unlink", remove],
        ["link", add],
      ] as const)
        for (const targetId of new Set(targets))
          plan.push({ traversal, pair: { ...base, targetId }, operation })
    }
    yield* lock({ objectType: object.id, id: source, creating }, plan)
    for (const replacement of replacements) {
      const current = yield* repository.ids(replacement.pair)
      if (
        current.length !== replacement.ids.length ||
        current.some((id, i) => id !== replacement.ids[i])
      )
        return yield* Effect.fail(
          new ObjectWriteConflict({ objectType: object.id, recordId: source })
        )
    }
    const references: Record<string, Record<string, string>> = {}
    const inserted = creating
      ? plan.filter(({ traversal, pair }) => {
          const physical = linkStorage(traversal.link)
          if (
            physical.kind !== "foreignKey" ||
            physical.side !== pair.direction
          )
            return false
          const table =
            storage.objects[physical.ownerType] ??
            storage.interfaces[physical.ownerType]!
          const columns = (references[table.name] ??= {})
          columns[physical.column] = pair.targetId
          return true
        })
      : []
    return {
      references,
      apply: (attributedId?: string) => apply(plan, attributedId, inserted),
    }
  })

  const mutate = Effect.fn("@company/Links.mutate")(
    function* (
      traversal: ModelLinkTraversal,
      input: LinkMutationInput,
      operation: "link" | "unlink"
    ) {
      if (!traversal.writable)
        return yield* Effect.fail(
          new LinkMutationNotAllowed({
            linkId: traversal.link.id,
            traversal: traversal.traversal.key,
          })
        )
      const sourceId = yield* identifiers.resolve(traversal.source.id, input.id)
      const pair = yield* pairFor(traversal, sourceId, input.target)
      const plan = [{ pair, traversal, operation }]
      yield* lock(
        {
          objectType: traversal.source.id,
          id: sourceId,
          ...(input.etag === undefined ? {} : { etag: input.etag }),
        },
        plan
      )
      yield* apply(plan)
      return undefined
    },
    (effect) => database.transaction(() => effect)
  )

  return {
    link: (traversal: ModelLinkTraversal, input: LinkMutationInput) =>
      mutate(traversal, input, "link"),
    unlink: (traversal: ModelLinkTraversal, input: LinkMutationInput) =>
      mutate(traversal, input, "unlink"),
    prepareCreate: (
      object: ObjectType,
      sourceId: RecordIdentifier,
      initial: InitialLinks
    ) => prepare(object, sourceId, initial, true),
    prepareUpdate: (
      object: ObjectType,
      sourceId: RecordIdentifier,
      changes: LinkUpdates
    ) => prepare(object, sourceId, changes),
  }
})
