import type { Action } from "./definition/action"
import type { InterfaceType } from "./definition/interface"
import type { LinkType } from "./definition/link"
import {
  type ModelCatalog,
  type ModelObject,
  modelActions,
  modelInterfaces,
  modelLinks,
  modelObjects,
} from "./definition/model"
import type { ObjectType } from "./definition/object"
import type { RootType } from "./definition/root"

export const API_DESCRIPTION_VERSION = "0.26" as const

type ObjectDescription = Omit<ObjectType, "actions" | "kind" | "parent"> & {
  parent: {
    readonly kind: "interface" | "object" | "root"
    readonly typeId: string
  }
}

/**
 * Serializable, public description derived from an API contract. Consumers
 * never maintain this projection by hand.
 */
export interface ApiDescription {
  readonly actions: ReadonlyArray<Action>
  readonly actor: { readonly typeId: string }
  readonly api: { readonly id: string; readonly name: string }
  readonly interfaces: ReadonlyArray<InterfaceType>
  readonly links: ReadonlyArray<LinkType>
  readonly objects: ReadonlyArray<ObjectDescription>
  readonly root: RootType
  readonly version: typeof API_DESCRIPTION_VERSION
}

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

function describeInterface(item: ReturnType<typeof modelInterfaces>[number]) {
  const { display, ...description } = item
  if (display === undefined) {
    return { ...description, properties: { ...item.properties } }
  }
  return {
    ...description,
    display: { ...display },
    properties: { ...item.properties },
  }
}

/** Derives transport- and UI-safe API metadata from the company model. */
export function createApiDescription(model: ModelCatalog): ApiDescription {
  return {
    version: API_DESCRIPTION_VERSION,
    actions: modelActions(model).map((action) => ({ ...action })),
    actor: { typeId: model.actor.id },
    api: { id: model.id, name: model.name },
    interfaces: modelInterfaces(model).map(describeInterface),
    links: modelLinks(model).map((link) => ({
      ...link,
      forward: {
        ...link.forward,
        from: { ...link.forward.from },
        to: { ...link.forward.to },
      },
      reverse: {
        ...link.reverse,
        from: { ...link.reverse.from },
        to: { ...link.reverse.to },
      },
    })),
    root: { ...model.root, interfaces: { ...model.root.interfaces } },
    objects: modelObjects(model).map(describeObject),
  }
}
