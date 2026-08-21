import {
  type ModelCatalog,
  modelActions,
  modelInterfaces,
  modelLinks,
  modelObjects,
} from "./definition/model"
import {
  API_DESCRIPTION_VERSION,
  type ApiDescription,
} from "./description-types"

/** Derives transport- and UI-safe API metadata from the company model. */
export function createApiDescription(model: ModelCatalog): ApiDescription {
  return {
    version: API_DESCRIPTION_VERSION,
    actions: modelActions(model).map((action) => ({ ...action })),
    api: { id: model.id, name: model.name },
    interfaces: modelInterfaces(model).map((item) => ({
      ...item,
      display: { ...item.display },
      properties: { ...item.properties },
    })),
    links: modelLinks(model).map((link) => ({
      ...link,
      from: { ...link.from },
      to: { ...link.to },
    })),
    root: { ...model.root },
    objects: modelObjects(model).map((object) => {
      const description: ApiDescription["objects"][number] = {
        id: object.id,
        collection: object.collection,
        name: object.name,
        interfaces: { ...object.interfaces },
        parent: { ...object.parent },
        pluralName: object.pluralName,
        properties: { ...object.properties },
        display: { ...object.display },
      }
      if (object.description !== undefined) {
        description.description = object.description
      }
      return description
    }),
  }
}
