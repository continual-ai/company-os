import { Context, Effect, Layer } from "effect"

import { resolveListRequest } from "#/runtime/contract/object-input.ts"
import { validateQuery } from "#/runtime/contract/query-validation.ts"
import { type ModelLinkTraversal } from "#/runtime/model/definition/model.ts"
import { RecordId } from "#/runtime/model/index.ts"
import type { LinkListInput } from "#/runtime/model/link-input.ts"
import { requireProjectAccess } from "#/runtime/server/auth/project-access.ts"
import { InvalidLinkRequest } from "#/runtime/server/errors.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { PageTokens } from "#/runtime/server/page-tokens.ts"
import { makeRecordHydration } from "#/runtime/server/storage/hydration.ts"
import { RecordIdentifiers } from "#/runtime/server/storage/identifiers.ts"
import { interfaceQuery } from "#/runtime/server/storage/interface-query.ts"
import { makeLinkWrites } from "#/runtime/server/storage/link-writes.ts"
import { RecordStore } from "#/runtime/server/storage/record-store.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"

const make = Effect.gen(function* () {
  const { model: Model, storage: Storage } = yield* ModelContext
  const database = yield* SqlDatabase
  const identifiers = yield* RecordIdentifiers
  const pageTokens = yield* PageTokens
  const records = yield* RecordStore
  const hydration = yield* makeRecordHydration
  const listInterface = interfaceQuery(
    Storage,
    database,
    pageTokens,
    identifiers
  )
  const { link, unlink } = yield* makeLinkWrites
  const list = Effect.fn("@company/Links.list")(function* (
    traversal: ModelLinkTraversal,
    input: LinkListInput
  ) {
    yield* requireProjectAccess
    const sourceId = yield* identifiers.resolve(traversal.source.id, input.id)
    yield* records
      .get(traversal.source)
      .getStates([RecordId(traversal.source.id)(sourceId)])
    const target = Object.values(Model.objects).find(
      (object) => object.id === traversal.target.from.typeId
    )
    yield* Effect.try({
      try: () =>
        validateQuery(
          Model,
          target ?? Model.interfaces[traversal.target.from.typeId]!,
          input
        ),
      catch: (error) =>
        new InvalidLinkRequest({
          message: error instanceof Error ? error.message : "Invalid query.",
          path: [],
        }),
    })
    const query = target
      ? yield* resolveListRequest(
          target,
          input,
          identifiers.resolveAliases,
          Model
        )
      : input.pageToken === undefined
        ? {}
        : { pageToken: input.pageToken }
    const relatedTo = {
      direction: traversal.direction,
      linkId: traversal.link.id,
      sourceId,
    }
    if (target) {
      const page = yield* records.get(target).list({ ...query, relatedTo })
      return {
        ...page,
        items: yield* hydration.expand(page.items, input.expand),
      }
    }
    const page = yield* listInterface(
      Model.interfaces[traversal.target.from.typeId]!,
      input,
      relatedTo
    )
    return {
      ...page,
      items: yield* hydration.expand(
        yield* hydration.load(page.items.map(({ id }) => id)),
        input.expand
      ),
    }
  })

  return {
    link: (...args: Parameters<typeof link>) =>
      requireProjectAccess.pipe(Effect.andThen(link(...args))),
    unlink: (...args: Parameters<typeof unlink>) =>
      requireProjectAccess.pipe(Effect.andThen(unlink(...args))),
    list,
  }
})

/** Governed execution for every model-derived Link traversal. */
export class Links extends Context.Service<Links>()("@company/Links", {
  make,
}) {
  static readonly layer = Layer.effect(this, this.make)
}
