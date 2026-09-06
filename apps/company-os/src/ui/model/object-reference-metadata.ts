import { modelRelationships, modelTypeAccepts } from "@company/runtime"
import { Model } from "company-os/model"

import type { ModelObject } from "./object-client"

/** Reverse navigation is derived from the stored reference; it never creates another relationship. */
export function referenceCollections(target: ModelObject) {
  return modelRelationships(Model).flatMap((relationship) => {
    const storage = relationship.storage
    if (
      storage.kind === "link" ||
      !modelTypeAccepts(Model, target.id, relationship.reverse.from.typeId)
    )
      return []
    const object = Object.values(Model.objects).find(
      (candidate) => candidate.id === storage.objectType
    )
    if (object === undefined)
      throw new Error(`Unknown relationship source '${storage.objectType}'.`)
    return [
      {
        key: relationship.id,
        object,
        field: storage.property,
        label: relationship.reverse.label,
      },
    ]
  })
}
