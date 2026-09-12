import { Root } from "#/runtime/model/core/root.ts"
import { isStandardActionId } from "#/runtime/model/definition/action.ts"
import { definitionId } from "#/runtime/model/definition/identity.ts"
import type { InterfaceType } from "#/runtime/model/definition/interface.ts"
import type { LinkType } from "#/runtime/model/definition/link.ts"
import type { ModuleDefinition } from "#/runtime/model/definition/module.ts"
import type { ObjectType } from "#/runtime/model/definition/object.ts"
import type { ModelRelationship } from "#/runtime/model/definition/relationship.ts"
import type { AnySchema } from "#/runtime/model/definition/schema.ts"

/** Query method ids the framework generates for every object. */
const generatedQueryMethodIds: ReadonlySet<string> = new Set([
  "batchGet",
  "get",
  "list",
  "search",
])

/** Type ids a schema refers to through record references, at any depth. */
function referencedTypeIds(definition: AnySchema): ReadonlyArray<string> {
  switch (definition.kind) {
    case "array":
      return referencedTypeIds(definition.items)
    case "map":
      return referencedTypeIds(definition.values)
    case "optional":
      return referencedTypeIds(definition.value)
    case "recordId":
      return [definition.typeId]
    case "struct":
      return Object.values(definition.properties).flatMap(referencedTypeIds)
    case "union":
      return definition.members.flatMap(referencedTypeIds)
    default:
      return []
  }
}

function duplicateValue(values: ReadonlyArray<string>): string | undefined {
  return values.find((value, index) => values.indexOf(value) !== index)
}

function objectTypeAccepts(object: ObjectType, expectedTypeId: string) {
  return (
    object.id === expectedTypeId ||
    Object.hasOwn(object.interfaces, expectedTypeId)
  )
}

interface ModelDefinitions {
  readonly interfaces: ReadonlyArray<InterfaceType>
  readonly links: ReadonlyArray<LinkType>
  readonly modules: ReadonlyArray<ModuleDefinition>
  readonly name: string
  readonly objects: ReadonlyArray<ObjectType>
}

function assertUniqueIdentifiers({
  interfaces,
  links,
  modules,
  name,
  objects,
}: ModelDefinitions): void {
  const duplicateModule = duplicateValue(modules.map((module) => module.id))
  if (duplicateModule !== undefined)
    throw new Error(
      `Module id '${duplicateModule}' is registered more than once.`
    )
  const objectTypeIds = objects.map((object) => object.id)
  const duplicateObject = duplicateValue(objectTypeIds)
  if (duplicateObject !== undefined)
    throw new Error(
      `Object id '${duplicateObject}' is registered more than once.`
    )
  const duplicateCollection = duplicateValue(
    objects.map((object) => object.collection)
  )
  if (duplicateCollection !== undefined)
    throw new Error(
      `Object collection '${duplicateCollection}' is registered more than once.`
    )
  const duplicateLink = duplicateValue(links.map((link) => link.id))
  if (duplicateLink !== undefined)
    throw new Error(`Link id '${duplicateLink}' is registered more than once.`)
  const interfaceIds = interfaces.map((item) => item.id)
  const duplicateInterface = duplicateValue(interfaceIds)
  if (duplicateInterface !== undefined)
    throw new Error(
      `Interface id '${duplicateInterface}' is registered more than once.`
    )
  const typeCollision = interfaceIds.find((id) => objectTypeIds.includes(id))
  if (typeCollision !== undefined)
    throw new Error(
      `Type id '${typeCollision}' is shared by an object and interface.`
    )
  if (objectTypeIds.includes(Root.id) || interfaceIds.includes(Root.id))
    throw new Error(
      `Root id '${Root.id}' must be unique within model '${name}'.`
    )
}

function assertReferencesRegistered(
  owner: string,
  schemas: ReadonlyArray<AnySchema>,
  registeredTypeIds: ReadonlySet<string>,
  modelName: string
): void {
  for (const referencedId of schemas.flatMap(referencedTypeIds)) {
    if (!registeredTypeIds.has(referencedId)) {
      throw new Error(
        `${owner} references type '${referencedId}', which is not registered in model '${modelName}'.`
      )
    }
  }
}

function assertObjectsResolvable({
  interfaces,
  name,
  objects,
}: ModelDefinitions): void {
  const interfaceIds = interfaces.map((item) => item.id)
  const objectsById = new Map(objects.map((object) => [object.id, object]))
  const registeredTypeIds = new Set([
    Root.id,
    ...objectsById.keys(),
    ...interfaceIds,
  ])
  for (const object of objects) {
    for (const [propertyId, property] of Object.entries(object.properties)) {
      assertReferencesRegistered(
        `Object '${object.id}' property '${propertyId}'`,
        [property],
        registeredTypeIds,
        name
      )
    }
    for (const implementation of Object.values(object.interfaces)) {
      if (!interfaceIds.includes(implementation.interfaceId)) {
        throw new Error(
          `Object '${object.id}' implements interface '${implementation.interfaceId}', which is not registered in model '${name}'.`
        )
      }
    }
  }
}

function assertLinksResolvable({
  interfaces,
  links,
  name,
  objects,
}: ModelDefinitions): void {
  const interfaceIds = interfaces.map((item) => item.id)
  const objectsById = new Map(objects.map((object) => [object.id, object]))
  const registeredTypeIds = new Set([
    Root.id,
    ...objectsById.keys(),
    ...interfaceIds,
  ])
  for (const link of links) {
    if (
      link.subsetOf !== undefined &&
      !links.some((candidate) => candidate.id === link.subsetOf)
    ) {
      throw new Error(
        `Link '${link.id}' selects from unregistered relationship '${link.subsetOf}'.`
      )
    }
    for (const traversal of [link.forward, link.reverse]) {
      const endpoint = traversal.from
      if (!registeredTypeIds.has(endpoint.typeId)) {
        throw new Error(
          `Link '${link.id}' references type '${endpoint.typeId}', which is not registered in model '${name}'.`
        )
      }
      const expectedKind = objectsById.has(endpoint.typeId)
        ? "object"
        : interfaceIds.includes(endpoint.typeId)
          ? "interface"
          : undefined
      if (expectedKind !== undefined && endpoint.kind !== expectedKind) {
        throw new Error(
          `Link '${link.id}' type '${endpoint.typeId}' changed kind after the link was defined.`
        )
      }
      const object = objectsById.get(endpoint.typeId)
      if (
        object !== undefined &&
        Object.hasOwn(object.properties, traversal.key)
      ) {
        throw new Error(
          `Link '${link.id}' traversal '${endpoint.typeId}.${traversal.key}' conflicts with an object property.`
        )
      }
      const interfaceType = interfaces.find(
        (item) => item.id === endpoint.typeId
      )
      if (
        interfaceType !== undefined &&
        Object.hasOwn(interfaceType.properties, traversal.key)
      ) {
        throw new Error(
          `Link '${link.id}' traversal '${endpoint.typeId}.${traversal.key}' conflicts with an interface property.`
        )
      }
    }
  }

  const linkMethods = links.flatMap((link) => [
    `${link.forward.from.typeId}.${link.forward.key}`,
    `${link.reverse.from.typeId}.${link.reverse.key}`,
  ])
  const duplicateLinkMethod = duplicateValue(linkMethods)
  if (duplicateLinkMethod !== undefined) {
    throw new Error(
      `Link traversal '${duplicateLinkMethod}' is registered more than once in model '${name}'.`
    )
  }
  for (const object of objects) {
    const traversals = links.flatMap((link) =>
      [link.forward, link.reverse].filter(
        ({ from }) =>
          (from.kind === "object" && from.typeId === object.id) ||
          (from.kind === "interface" &&
            Object.hasOwn(object.interfaces, from.typeId))
      )
    )
    const duplicateTraversal = duplicateValue(traversals.map(({ key }) => key))
    if (duplicateTraversal !== undefined) {
      throw new Error(
        `Object '${object.id}' receives Link traversal '${duplicateTraversal}' more than once in model '${name}'.`
      )
    }
    const propertyConflict = traversals.find(({ key }) =>
      Object.hasOwn(object.properties, key)
    )
    if (propertyConflict !== undefined) {
      throw new Error(
        `Link traversal '${object.id}.${propertyConflict.key}' conflicts with an object property.`
      )
    }
    const methodIds = new Set([
      ...generatedQueryMethodIds,
      ...Object.keys(object.actions),
    ])
    const methodConflict = traversals.find(({ key }) => methodIds.has(key))
    if (methodConflict !== undefined) {
      throw new Error(
        `Link traversal '${object.id}.${methodConflict.key}' conflicts with a generated Query or Action method.`
      )
    }
  }
}

function assertUniqueRulesResolvable({
  objects,
  links,
}: ModelDefinitions): void {
  for (const object of objects) {
    for (const [ruleId, fields] of Object.entries(object.uniqueBy)) {
      for (const field of fields) {
        if (
          !Object.hasOwn(object.properties, field) &&
          !links.some((link) =>
            [link.forward, link.reverse].some(
              (end) =>
                (end.from.typeId === object.id ||
                  Object.hasOwn(object.interfaces, end.from.typeId)) &&
                end.key === field &&
                end.max === 1
            )
          )
        ) {
          throw new Error(
            `Object '${object.id}' unique rule '${ruleId}' references unknown field '${field}'.`
          )
        }
      }
    }
  }
}

/** Rejects definitions that cannot form one closed, unambiguous model. */
export function assertModelDefinitionsValid(
  definitions: ModelDefinitions
): void {
  assertUniqueIdentifiers(definitions)
  assertObjectsResolvable(definitions)
  assertOperationsResolvable(definitions)
  assertLinksResolvable(definitions)
  assertUniqueRulesResolvable(definitions)
}

/** Every relationship direction must project onto a name no property, method, or other relationship uses. */
export function assertRelationshipNamesUnambiguous(
  objects: ReadonlyArray<ObjectType>,
  relationships: ReadonlyArray<ModelRelationship>
): void {
  for (const object of objects) {
    const names = new Set([
      ...Object.keys(object.properties),
      ...generatedQueryMethodIds,
      ...Object.keys(object.actions),
    ])
    for (const relationship of relationships) {
      const sides = [relationship.forward, relationship.reverse]
      for (const side of sides) {
        if (!objectTypeAccepts(object, side.from.typeId)) continue
        definitionId(side.key)
        if (names.has(side.key))
          throw new Error(
            `Relationship '${object.id}.${side.key}' conflicts with another relationship, property, or method.`
          )
        names.add(side.key)
      }
    }
  }
}

interface ModuleDependency {
  readonly moduleId: string
  readonly reason: string
}

/**
 * Modules another module depends on, derived from every type and link its
 * definitions reference. Kernel types such as Root and Actor have no owner.
 */
export function moduleDependencies(
  module: ModuleDefinition,
  modules: ReadonlyArray<ModuleDefinition>
): ReadonlyArray<ModuleDependency> {
  const typeOwners = new Map<string, string>()
  const linkOwners = new Map<string, string>()
  for (const candidate of modules) {
    for (const object of candidate.objects)
      typeOwners.set(object.id, candidate.id)
    for (const item of candidate.interfaces)
      typeOwners.set(item.id, candidate.id)
    for (const link of candidate.links) linkOwners.set(link.id, candidate.id)
  }
  const dependencies = new Map<string, ModuleDependency>()
  const depend = (
    owners: ReadonlyMap<string, string>,
    id: string,
    reason: string
  ) => {
    const owner = owners.get(id)
    if (owner === undefined || owner === module.id) return
    if (!dependencies.has(owner))
      dependencies.set(owner, { moduleId: owner, reason })
  }
  for (const object of module.objects) {
    const references = [
      ...Object.keys(object.interfaces),
      ...Object.values(object.properties).flatMap(referencedTypeIds),
    ]
    for (const typeId of references)
      depend(typeOwners, typeId, `object '${object.id}' references '${typeId}'`)
  }
  for (const operation of [...module.actions, ...module.queries]) {
    const types = [
      ...referencedTypeIds(operation.input),
      ...referencedTypeIds(operation.output),
      ...(operation.objectType ? [operation.objectType] : []),
    ]
    for (const id of types)
      depend(typeOwners, id, `operation '${operation.key}' references '${id}'`)
  }
  for (const link of module.links) {
    for (const typeId of [link.forward.from.typeId, link.reverse.from.typeId])
      depend(typeOwners, typeId, `link '${link.id}' references '${typeId}'`)
    if (link.subsetOf !== undefined)
      depend(
        linkOwners,
        link.subsetOf,
        `link '${link.id}' selects from '${link.subsetOf}'`
      )
  }
  for (const event of module.events) {
    for (const typeId of referencedTypeIds(event.data))
      depend(typeOwners, typeId, `event '${event.type}' references '${typeId}'`)
  }
  return [...dependencies.values()]
}

/** Rejects an enabled set that leaves one of its members' dependencies disabled. */
export function assertModulesClosed(
  enabled: ReadonlyArray<ModuleDefinition>,
  modules: ReadonlyArray<ModuleDefinition>
): void {
  const enabledIds = new Set(enabled.map((module) => module.id))
  for (const module of enabled) {
    for (const dependency of moduleDependencies(module, modules)) {
      if (!enabledIds.has(dependency.moduleId))
        throw new Error(
          `Module '${module.id}' depends on module '${dependency.moduleId}' (${dependency.reason}), which is not enabled.`
        )
    }
  }
}

function assertOperationsResolvable({
  objects,
  interfaces,
  modules,
  name,
  links,
}: ModelDefinitions): void {
  const registered = new Set([
    Root.id,
    ...objects.map((o) => o.id),
    ...interfaces.map((i) => i.id),
  ])
  const keys = new Set<string>()
  for (const module of modules)
    for (const operation of [...module.actions, ...module.queries]) {
      if (keys.has(operation.key))
        throw new Error(`Duplicate operation '${operation.key}'.`)
      keys.add(operation.key)
      if (operation.objectType === undefined) {
        if (
          ["records", "events", ...objects.map((o) => o.id)].includes(
            operation.id
          )
        )
          throw new Error(
            `Global operation '${operation.id}' conflicts with a client namespace.`
          )
      } else {
        const object = objects.find((o) => o.id === operation.objectType)
        if (!object)
          throw new Error(
            `Operation '${operation.key}' targets an object not registered in model '${name}'.`
          )
        if (
          isStandardActionId(operation.id) ||
          generatedQueryMethodIds.has(operation.id)
        )
          throw new Error(
            `Operation '${operation.key}' conflicts with a standard operation.`
          )
        if (
          links.some((link) =>
            [link.forward, link.reverse].some(
              (side) =>
                objectTypeAccepts(object, side.from.typeId) &&
                side.key === operation.id
            )
          )
        )
          throw new Error(
            `Operation '${operation.key}' conflicts with a Link traversal.`
          )
      }
      assertReferencesRegistered(
        `Operation '${operation.key}'`,
        [operation.input, operation.output],
        registered,
        name
      )
    }
}
