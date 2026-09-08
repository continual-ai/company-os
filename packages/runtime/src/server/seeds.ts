import { Effect } from "effect"

import {
  modelObjectLinkTraversals,
  type ObjectType,
  type RecordId,
} from "#/model/index.ts"
import { ModelContext } from "#/server/model-context.ts"
import { Links } from "#/server/model/link-service.ts"

/** Connects fixtures through the same relationship catalog and mutations as the application. */
export const linkSeedRecords = Effect.fn("@company/linkSeedRecords")(function* (
  object: ObjectType,
  key: string,
  id: RecordId,
  target: RecordId
) {
  const { model: Model } = yield* ModelContext
  const traversal = modelObjectLinkTraversals(Model, object).find(
    (entry) => entry.traversal.key === key
  )
  if (traversal === undefined)
    return yield* Effect.fail(
      new Error(`Unknown relationship '${object.id}.${key}'.`)
    )
  return yield* (yield* Links).link(traversal, { id, target })
})
