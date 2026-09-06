import type { ListRequest, Page } from "@company/runtime"
import { Effect } from "effect"

import { type ClientRecord, type DynamicLinkClient } from "./object-client"

/** Checks the target type while preserving the server page and its record order. */
export function loadRelationshipCollectionPage({
  list,
  objectType,
  request,
  sourceId,
}: {
  readonly list: DynamicLinkClient["list"]
  readonly objectType: string
  readonly request: ListRequest
  readonly sourceId: string
}): Effect.Effect<Page<ClientRecord>, unknown> {
  return Effect.gen(function* () {
    const page = yield* list({
      id: sourceId,
      ...(request.pageSize === undefined ? {} : { pageSize: request.pageSize }),
      ...(request.pageToken === undefined
        ? {}
        : { pageToken: request.pageToken }),
    })
    const unexpected = page.items.find(
      (reference) => reference.objectType !== objectType
    )
    if (unexpected !== undefined) {
      throw new Error(
        `Relationship returned '${unexpected.objectType}' where '${objectType}' was expected.`
      )
    }
    return page
  })
}
