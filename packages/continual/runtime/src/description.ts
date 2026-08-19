import type { DefinedApi } from "./definition/api"
import {
  API_DESCRIPTION_VERSION,
  type ApiDescription,
} from "./description-types"

/** Derives transport- and UI-safe metadata from the live semantic API. */
export function createApiDescription(api: DefinedApi): ApiDescription {
  return {
    version: API_DESCRIPTION_VERSION,
    api: { id: api.id, name: api.name },
    modules: api.modules.map((module) => ({
      id: module.id,
      name: module.name,
      actions: module.actions.map((action) => ({ ...action })),
      objects: module.objects.map((object) => {
        const description: ApiDescription["modules"][number]["objects"][number] =
          {
            id: object.id,
            collection: object.collection,
            name: object.name,
            pluralName: object.pluralName,
            operations: { ...object.operations },
            fields: { ...object.fields },
            display: { ...object.display },
          }
        if (object.description !== undefined) {
          description.description = object.description
        }
        return description
      }),
    })),
  }
}
