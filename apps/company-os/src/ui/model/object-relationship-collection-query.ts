import type { ListRequest, Page } from "@company/runtime"

import {
  type clientFor,
  type ClientRecord,
  type DynamicLinkClient,
} from "./object-client"

/** Hydrates one model Link page into the homogeneous records a table consumes. */
export async function loadRelationshipCollectionPage({
  batchGet,
  list,
  objectType,
  request,
  sourceId,
}: {
  readonly batchGet: ReturnType<typeof clientFor>["batchGet"]
  readonly list: DynamicLinkClient["list"]
  readonly objectType: string
  readonly request: ListRequest
  readonly sourceId: string
}): Promise<Page<ClientRecord>> {
  const page = await list({
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
  if (page.items.length === 0) return { ...page, items: [] }

  const batch = await batchGet({
    ids: page.items.map(({ id }) => id),
  })
  const records = new Map(batch.items.map((record) => [record.id, record]))
  return {
    ...page,
    items: page.items.map(({ id }) => {
      const record = records.get(id)
      if (record === undefined) {
        throw new Error(`Related record '${id}' could not be loaded.`)
      }
      return record
    }),
  }
}
