import type { LinkType } from "#/runtime/model/definition/link.ts"
import type { ModelCatalog } from "#/runtime/model/definition/model.ts"

export type ModelRelationship = LinkType

export function modelRelationships(
  model: ModelCatalog
): ReadonlyArray<ModelRelationship> {
  return Object.values(model.links)
}
