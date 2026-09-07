import {
  modelObjectLinkTraversals,
  type ObjectType,
  type RecordId,
} from "@company/runtime"
import { Model } from "company-os/model"
import { Effect } from "effect"

import { Links } from "@/server/model/link-service"

/** Connects fixtures through the same relationship catalog and mutations as the application. */
export const linkSeedRecords = Effect.fn("@company/linkSeedRecords")(function* (
  object: ObjectType,
  key: string,
  id: RecordId,
  target: RecordId
) {
  const traversal = modelObjectLinkTraversals(Model, object).find(
    (entry) => entry.traversal.key === key
  )
  if (traversal === undefined)
    return yield* Effect.fail(
      new Error(`Unknown relationship '${object.id}.${key}'.`)
    )
  return yield* (yield* Links).link(traversal, { id, target })
})
