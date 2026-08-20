import { type Action, actionKey, standardActions } from "./action"
import { definitionId } from "./identity"
import type { LinkType } from "./link"
import type { ObjectType } from "./object"
import { Root, type RootType } from "./root"
import type { AnySchema } from "./schema"

type ObjectRegistry<TObjects extends ReadonlyArray<ObjectType>> = {
  readonly [TObject in TObjects[number] as TObject["id"]]: TObject
}

type LinkRegistry<TLinks extends ReadonlyArray<LinkType>> = {
  readonly [TLink in TLinks[number] as TLink["id"]]: TLink
}

type ObjectActionUnion<TObject extends ObjectType> =
  | TObject["actions"][keyof TObject["actions"]]
  | (TObject["defaultActions"]["create"] extends true
      ? Action<"create", TObject["id"]>
      : never)
  | (TObject["defaultActions"]["delete"] extends true
      ? Action<"delete", TObject["id"]>
      : never)
  | (TObject["defaultActions"]["update"] extends true
      ? Action<"update", TObject["id"]>
      : never)

type ActionRegistry<TObjects extends ReadonlyArray<ObjectType>> = {
  readonly [TObject in TObjects[number] as TObject["id"]]: {
    readonly [TAction in ObjectActionUnion<TObject> as TAction["id"]]: TAction
  }
}

declare const modelTypes: unique symbol

export interface ModelCatalog {
  readonly [modelTypes]?: {
    readonly links: ReadonlyArray<LinkType>
    readonly objects: ReadonlyArray<ObjectType>
  }
  actions: object
  id: string
  kind: "model"
  links: object
  name: string
  objects: object
  root: RootType
}

export interface Model<
  TId extends string = string,
  TObjects extends ReadonlyArray<ObjectType> = ReadonlyArray<ObjectType>,
  TLinks extends ReadonlyArray<LinkType> = ReadonlyArray<LinkType>,
> {
  readonly [modelTypes]?: {
    readonly links: TLinks
    readonly objects: TObjects
  }
  actions: ActionRegistry<TObjects>
  id: TId
  kind: "model"
  links: LinkRegistry<TLinks>
  name: string
  objects: ObjectRegistry<TObjects>
  root: RootType
}

export type ModelObject<TModel extends ModelCatalog> = NonNullable<
  TModel[typeof modelTypes]
>["objects"][number]

function referencedObjectIds(definition: AnySchema): ReadonlyArray<string> {
  switch (definition.kind) {
    case "array":
      return referencedObjectIds(definition.items)
    case "map":
      return referencedObjectIds(definition.values)
    case "optional":
      return referencedObjectIds(definition.value)
    case "recordId":
      return [definition.objectId]
    case "struct":
      return Object.values(definition.properties).flatMap(referencedObjectIds)
    case "union":
      return definition.members.flatMap(referencedObjectIds)
    default:
      return []
  }
}

function assertReferencesRegistered(
  owner: string,
  schemas: ReadonlyArray<AnySchema>,
  objectIds: ReadonlySet<string>,
  modelId: string
): void {
  for (const referencedId of schemas.flatMap(referencedObjectIds)) {
    if (!objectIds.has(referencedId)) {
      throw new Error(
        `${owner} references object '${referencedId}', which is not registered in model '${modelId}'.`
      )
    }
  }
}

function duplicateValue(values: ReadonlyArray<string>): string | undefined {
  return values.find((value, index) => values.indexOf(value) !== index)
}

export function defineModel<
  const TId extends string,
  const TObjects extends ReadonlyArray<ObjectType>,
  const TLinks extends ReadonlyArray<LinkType>,
>(definition: {
  id: TId
  links: TLinks
  name: string
  objects: TObjects
}): Model<TId, TObjects, TLinks> {
  const objectIds = definition.objects.map((object) => object.id)
  const duplicateObject = duplicateValue(objectIds)
  if (duplicateObject !== undefined) {
    throw new Error(
      `Object id '${duplicateObject}' is registered more than once.`
    )
  }

  const collections = definition.objects.map((object) => object.collection)
  const duplicateCollection = duplicateValue(collections)
  if (duplicateCollection !== undefined) {
    throw new Error(
      `Object collection '${duplicateCollection}' is registered more than once.`
    )
  }

  const linkIds = definition.links.map((link) => link.id)
  const duplicateLink = duplicateValue(linkIds)
  if (duplicateLink !== undefined) {
    throw new Error(`Link id '${duplicateLink}' is registered more than once.`)
  }

  const registeredObjectIds = new Set(objectIds)
  for (const object of definition.objects) {
    if (
      object.parent.objectId !== Root.id &&
      !registeredObjectIds.has(object.parent.objectId)
    ) {
      throw new Error(
        `Object '${object.id}' parent references object '${object.parent.objectId}', which is not registered in model '${definition.id}'.`
      )
    }
    for (const [propertyId, property] of Object.entries(object.properties)) {
      assertReferencesRegistered(
        `Object '${object.id}' property '${propertyId}'`,
        [property],
        registeredObjectIds,
        definition.id
      )
    }
    for (const action of Object.values(object.actions)) {
      assertReferencesRegistered(
        `Action '${actionKey(action)}'`,
        [action.input, action.output],
        registeredObjectIds,
        definition.id
      )
    }
  }

  const objectsById = new Map(
    definition.objects.map((object) => [object.id, object])
  )
  for (const object of definition.objects) {
    const ancestry = new Set([object.id])
    let parentId = object.parent.objectId
    while (parentId !== Root.id) {
      if (ancestry.has(parentId)) {
        throw new Error(
          `Object '${object.id}' has a cyclic parent hierarchy in model '${definition.id}'.`
        )
      }
      ancestry.add(parentId)
      const parent = objectsById.get(parentId)
      if (parent === undefined) break
      parentId = parent.parent.objectId
    }
  }

  for (const link of definition.links) {
    for (const side of [link.from, link.to]) {
      if (!registeredObjectIds.has(side.objectId)) {
        throw new Error(
          `Link '${link.id}' references object '${side.objectId}', which is not registered in model '${definition.id}'.`
        )
      }
    }
  }

  const linkMethods = definition.links.flatMap((link) => [
    `${link.from.objectId}.${link.from.name}`,
    `${link.to.objectId}.${link.to.name}`,
  ])
  const duplicateLinkMethod = duplicateValue(linkMethods)
  if (duplicateLinkMethod !== undefined) {
    throw new Error(
      `Link traversal '${duplicateLinkMethod}' is registered more than once in model '${definition.id}'.`
    )
  }

  const allActions = definition.objects.flatMap((object) => [
    ...standardActions(object),
    ...Object.values(object.actions),
  ])
  const duplicateAction = duplicateValue(allActions.map(actionKey))
  if (duplicateAction !== undefined) {
    throw new Error(`Action '${duplicateAction}' is registered more than once.`)
  }

  const objects = Object.fromEntries(
    definition.objects.map((object) => [object.id, object])
  )
  const links = Object.fromEntries(
    definition.links.map((link) => [link.id, link])
  )
  const actions = Object.fromEntries(
    definition.objects.map((object) => [
      object.id,
      Object.fromEntries(
        allActions
          .filter((action) => action.objectId === object.id)
          .map((action) => [action.id, action])
      ),
    ])
  )

  // SAFETY: duplicate identifiers were rejected before building the registries.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
  return {
    actions,
    id: definitionId(definition.id),
    kind: "model",
    links,
    name: definition.name,
    objects,
    root: Root,
  } as unknown as Model<TId, TObjects, TLinks>
}

export function modelActions(model: ModelCatalog): ReadonlyArray<Action> {
  const actions = Object.values(model.actions).flatMap((group) =>
    Object.values(group)
  )
  // SAFETY: defineModel exclusively builds each group from normalized actions.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return actions as ReadonlyArray<Action>
}

export function modelLinks(model: ModelCatalog): ReadonlyArray<LinkType> {
  const links = Object.values(model.links)
  // SAFETY: defineModel exclusively builds this registry from validated links.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return links as ReadonlyArray<LinkType>
}

export function modelObjects(model: ModelCatalog): ReadonlyArray<ObjectType> {
  const objects = Object.values(model.objects)
  // SAFETY: defineModel exclusively builds this registry from validated objects.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return objects as ReadonlyArray<ObjectType>
}
