import { Data, Effect } from "effect"

import {
  type ModelCatalog,
  type ModelLinkTraversal,
  modelObjectLinkTraversals,
} from "./definition/model"
import type { ObjectRef, ObjectType } from "./definition/object"
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type Page,
  type PageToken,
} from "./definition/request"
import type { RecordIdentifier } from "./definition/schema"
import type {
  LinkCardinalityConflict,
  LinkRepository,
  LinkList,
} from "./effect-link-repository"

export class LinkMutationNotAllowed extends Data.TaggedError(
  "LinkMutationNotAllowed"
)<{
  readonly linkId: string
  readonly traversal: string
}> {}

export class InvalidLinkRequest extends Data.TaggedError("InvalidLinkRequest")<{
  readonly message: string
  readonly path: ReadonlyArray<string>
}> {}

export class RequiredLinkMissing extends Data.TaggedError(
  "RequiredLinkMissing"
)<{
  readonly objectType: string
  readonly traversal: string
}> {}

export class RequiredLinkUnlink extends Data.TaggedError("RequiredLinkUnlink")<{
  readonly linkId: string
  readonly traversal: string
}> {}

export interface LinkListInput {
  readonly id: RecordIdentifier
  readonly pageSize?: number
  readonly pageToken?: PageToken
}

export interface LinkMutationInput {
  readonly id: RecordIdentifier
  readonly target: RecordIdentifier
}

export type InitialLinks = Readonly<
  Record<
    string,
    RecordIdentifier | ReadonlyArray<RecordIdentifier> | null | undefined
  >
>

export interface LinkChanges {
  readonly add?: ReadonlyArray<RecordIdentifier>
  readonly remove?: ReadonlyArray<RecordIdentifier>
}

export type LinkUpdates = Readonly<Record<string, LinkChanges | undefined>>

export interface LinkAccessRequest {
  readonly operation: "initialize" | "link" | "list" | "unlink"
  readonly source: ObjectType
  readonly sourceId: string
  readonly targetId?: string
  readonly traversal: ModelLinkTraversal
}

export interface LinkWriterOptions<
  TResolveError,
  TResolveRequirements = never,
> {
  readonly resolve: (
    typeId: string,
    identifier: RecordIdentifier
  ) => Effect.Effect<string, TResolveError, TResolveRequirements>
}

export interface LinkServiceOptions<
  TResolveError,
  TAuthorizationError,
  TResolveRequirements = never,
  TAuthorizationRequirements = never,
> extends LinkWriterOptions<TResolveError, TResolveRequirements> {
  readonly authorize: (
    request: LinkAccessRequest
  ) => Effect.Effect<void, TAuthorizationError, TAuthorizationRequirements>
  readonly visibility: (traversal: ModelLinkTraversal) => Effect.Effect<
    ReadonlyArray<{
      readonly objectType: string
      readonly visibleWithin: ReadonlyArray<string>
    }>,
    TAuthorizationError,
    TAuthorizationRequirements
  >
}

export interface LinkWriter<TError = never, TRequirements = never> {
  readonly initialize: (
    object: ObjectType,
    sourceId: string,
    links: InitialLinks
  ) => Effect.Effect<void, TError, TRequirements>
  readonly link: (
    traversal: ModelLinkTraversal,
    input: LinkMutationInput
  ) => Effect.Effect<void, TError, TRequirements>
  readonly update: (
    object: ObjectType,
    sourceId: RecordIdentifier,
    links: LinkUpdates
  ) => Effect.Effect<void, TError, TRequirements>
  readonly unlink: (
    traversal: ModelLinkTraversal,
    input: LinkMutationInput
  ) => Effect.Effect<void, TError, TRequirements>
}

export interface LinkService<
  TError = never,
  TRequirements = never,
> extends LinkWriter<TError, TRequirements> {
  readonly list: (
    traversal: ModelLinkTraversal,
    input: LinkListInput
  ) => Effect.Effect<Page<ObjectRef>, TError, TRequirements>
  readonly unlink: (
    traversal: ModelLinkTraversal,
    input: LinkMutationInput
  ) => Effect.Effect<void, TError, TRequirements>
}

function isIdentifierList(
  value: RecordIdentifier | ReadonlyArray<RecordIdentifier>
): value is ReadonlyArray<RecordIdentifier> {
  return Array.isArray(value)
}

function values(
  value: RecordIdentifier | ReadonlyArray<RecordIdentifier> | null | undefined
): ReadonlyArray<RecordIdentifier> {
  if (value === undefined || value === null) return []
  return isIdentifierList(value) ? value : [value]
}

type LinkAuthorizer<TError, TRequirements> = (
  request: LinkAccessRequest
) => Effect.Effect<void, TError, TRequirements>

function makeLinkWriteMethods<
  TRepositoryError,
  TRepositoryRequirements,
  TResolveError,
  TResolveRequirements,
  TAuthorizationError,
  TAuthorizationRequirements,
>(
  model: ModelCatalog,
  repository: LinkRepository<TRepositoryError, TRepositoryRequirements>,
  options: LinkWriterOptions<TResolveError, TResolveRequirements>,
  authorize?: LinkAuthorizer<TAuthorizationError, TAuthorizationRequirements>
): LinkWriter<
  | TRepositoryError
  | TResolveError
  | TAuthorizationError
  | LinkCardinalityConflict
  | InvalidLinkRequest
  | LinkMutationNotAllowed
  | RequiredLinkMissing
  | RequiredLinkUnlink,
  TRepositoryRequirements | TResolveRequirements | TAuthorizationRequirements
> {
  const resolvePair = Effect.fn("@company/runtime/LinkWriter.resolvePair")(
    function* (traversal: ModelLinkTraversal, input: LinkMutationInput) {
      const sourceId = yield* options.resolve(traversal.source.id, input.id)
      const targetId = yield* options.resolve(
        traversal.target.from.typeId,
        input.target
      )
      return {
        direction: traversal.direction,
        linkId: traversal.link.id,
        sourceId,
        targetId,
      } as const
    }
  )

  const authorizeRequest = (request: LinkAccessRequest) =>
    authorize === undefined ? Effect.void : authorize(request)

  const initialize = Effect.fn("@company/runtime/LinkWriter.initialize")(
    function* (object, sourceId, initial) {
      const traversals = modelObjectLinkTraversals(model, object).filter(
        ({ initializable }) => initializable
      )
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
        const targets = values(initial[traversal.traversal.key])
        if (traversal.traversal.cardinality !== "many" && targets.length > 1) {
          return yield* Effect.fail(
            new InvalidLinkRequest({
              message: "A singular Link accepts at most one target.",
              path: ["links", traversal.traversal.key],
            })
          )
        }
        if (traversal.traversal.cardinality === "one" && targets.length === 0) {
          return yield* Effect.fail(
            new RequiredLinkMissing({
              objectType: object.id,
              traversal: traversal.traversal.key,
            })
          )
        }
        for (const target of targets) {
          const targetId = yield* options.resolve(
            traversal.target.from.typeId,
            target
          )
          yield* authorizeRequest({
            operation: "initialize",
            source: traversal.source,
            sourceId,
            targetId,
            traversal,
          })
          yield* repository.link({
            direction: traversal.direction,
            linkId: traversal.link.id,
            sourceId,
            targetId,
          })
        }
      }
      return undefined
    }
  )
  const link = Effect.fn("@company/runtime/LinkWriter.link")(
    function* (traversal, input) {
      if (!traversal.writable) {
        return yield* Effect.fail(
          new LinkMutationNotAllowed({
            linkId: traversal.link.id,
            traversal: traversal.traversal.key,
          })
        )
      }
      const pair = yield* resolvePair(traversal, input)
      yield* authorizeRequest({
        operation: "link",
        source: traversal.source,
        sourceId: pair.sourceId,
        targetId: pair.targetId,
        traversal,
      })
      yield* repository.link(pair)
      return undefined
    }
  )
  const unlink = Effect.fn("@company/runtime/LinkWriter.unlink")(
    function* (traversal, input) {
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
      yield* authorizeRequest({
        operation: "unlink",
        source: traversal.source,
        sourceId: pair.sourceId,
        targetId: pair.targetId,
        traversal,
      })
      yield* repository.unlink(pair)
      return undefined
    }
  )
  const update = Effect.fn("@company/runtime/LinkWriter.update")(
    function* (object, sourceId, changes) {
      const traversals = modelObjectLinkTraversals(model, object).filter(
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
        for (const target of remove) {
          yield* unlink(traversal, { id: sourceId, target })
        }
        for (const target of add) {
          yield* link(traversal, { id: sourceId, target })
        }
      }
      return undefined
    }
  )

  return { initialize, link, unlink, update }
}

/** Builds governed Link behavior shared by HTTP, MCP, and browser clients. */
export function makeLinkService<
  TRepositoryError,
  TRepositoryRequirements,
  TResolveError,
  TAuthorizationError,
  TResolveRequirements,
  TAuthorizationRequirements,
>(
  model: ModelCatalog,
  repository: LinkRepository<TRepositoryError, TRepositoryRequirements>,
  options: LinkServiceOptions<
    TResolveError,
    TAuthorizationError,
    TResolveRequirements,
    TAuthorizationRequirements
  >
): LinkService<
  | TRepositoryError
  | TResolveError
  | TAuthorizationError
  | LinkCardinalityConflict
  | InvalidLinkRequest
  | LinkMutationNotAllowed
  | RequiredLinkMissing
  | RequiredLinkUnlink,
  TRepositoryRequirements | TResolveRequirements | TAuthorizationRequirements
> {
  const writer = makeLinkWriteMethods(
    model,
    repository,
    options,
    options.authorize
  )

  return {
    ...writer,
    list: Effect.fn("@company/runtime/LinkService.list")(
      function* (traversal, input) {
        const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE
        if (pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
          return yield* Effect.fail(
            new InvalidLinkRequest({
              message: `pageSize must be between 1 and ${MAX_PAGE_SIZE}.`,
              path: ["pageSize"],
            })
          )
        }
        const sourceId = yield* options.resolve(traversal.source.id, input.id)
        yield* options.authorize({
          operation: "list",
          source: traversal.source,
          sourceId,
          traversal,
        })
        const request: LinkList =
          input.pageToken === undefined
            ? {
                direction: traversal.direction,
                linkId: traversal.link.id,
                pageSize,
                sourceId,
              }
            : {
                direction: traversal.direction,
                linkId: traversal.link.id,
                pageSize,
                pageToken: input.pageToken,
                sourceId,
              }
        return yield* repository.list(request, {
          targets: yield* options.visibility(traversal),
        })
      }
    ),
  }
}

/**
 * Builds validated server-internal Link writes for custom business Actions.
 * Callers must establish authority and a transaction before using this writer.
 */
export function makeLinkWriter<
  TRepositoryError,
  TRepositoryRequirements,
  TResolveError,
  TResolveRequirements,
>(
  model: ModelCatalog,
  repository: LinkRepository<TRepositoryError, TRepositoryRequirements>,
  options: LinkWriterOptions<TResolveError, TResolveRequirements>
): LinkWriter<
  | TRepositoryError
  | TResolveError
  | LinkCardinalityConflict
  | InvalidLinkRequest
  | LinkMutationNotAllowed
  | RequiredLinkMissing
  | RequiredLinkUnlink,
  TRepositoryRequirements | TResolveRequirements
> {
  return makeLinkWriteMethods<
    TRepositoryError,
    TRepositoryRequirements,
    TResolveError,
    TResolveRequirements,
    never,
    never
  >(model, repository, options)
}
