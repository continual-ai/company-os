import type { Action } from "./definition/action"
import type { InterfaceType } from "./definition/interface"
import type { LinkType } from "./definition/link"
import {
  type ModelCatalog,
  type ModelObject,
  modelActions,
  modelInterfaces,
  modelLinks,
  modelModules,
  modelObjects,
  modelQueries,
} from "./definition/model"
import type { ObjectType } from "./definition/object"
import type { Query } from "./definition/query"
import type { RootType } from "./definition/root"

export const MODEL_DESCRIPTION_VERSION = "0.30" as const

type ObjectDescription = Omit<ObjectType, "actions" | "kind" | "parent"> & {
  parent: {
    readonly kind: "interface" | "object" | "root"
    readonly typeId: string
  }
}

/** Serializable membership metadata for one declared model module. */
export interface ModuleDescription {
  readonly id: string
  readonly interfaceIds: ReadonlyArray<string>
  readonly linkIds: ReadonlyArray<string>
  readonly name: string
  readonly objectIds: ReadonlyArray<string>
}

/**
 * Serializable, public description derived from an API contract. Consumers
 * never maintain this projection by hand.
 */
export interface ModelDescription {
  readonly actions: ReadonlyArray<Action>
  readonly actor: { readonly typeId: string }
  readonly interfaces: ReadonlyArray<InterfaceType>
  readonly links: ReadonlyArray<LinkType>
  readonly model: { readonly name: string }
  readonly modules: ReadonlyArray<ModuleDescription>
  readonly objects: ReadonlyArray<ObjectDescription>
  readonly queries: ReadonlyArray<Query>
  readonly root: RootType
  readonly version: typeof MODEL_DESCRIPTION_VERSION
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

/** Derives transport- and UI-safe metadata from a portable model. */
export function describeModel(model: ModelCatalog): ModelDescription {
  return {
    version: MODEL_DESCRIPTION_VERSION,
    actions: modelActions(model).map((action) => ({ ...action })),
    actor: { typeId: model.actor.id },
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
    model: { name: model.name },
    modules: modelModules(model).map((module) => ({
      id: module.id,
      interfaceIds: module.interfaces.map((item) => item.id),
      linkIds: module.links.map((link) => link.id),
      name: module.name,
      objectIds: module.objects.map((object) => object.id),
    })),
    queries: modelQueries(model).map((query) => ({ ...query })),
    root: { ...model.root, interfaces: { ...model.root.interfaces } },
    objects: modelObjects(model).map(describeObject),
  }
}
