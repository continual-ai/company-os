import {
  type ModelCatalog,
  type ModelObject,
  modelActions,
  modelInterfaces,
  modelLinks,
  modelObjects,
} from "./definition/model"
import {
  API_DESCRIPTION_VERSION,
  type ApiDescription,
  type ObjectDescription,
} from "./description-types"

function describeObject({
  actions: _actions,
  kind: _kind,
  ...description
}: ModelObject<ModelCatalog>): ObjectDescription {
  return {
    ...description,
    display: { ...description.display },
    interfaces: { ...description.interfaces },
    parent: { ...description.parent },
    properties: { ...description.properties },
  }
}

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
    objects: modelObjects(model).map(describeObject),
  }
}
