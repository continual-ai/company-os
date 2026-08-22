import { definitionId } from "./identity"
import type { Properties } from "./property"
import type {
  AnySchema,
  EnumSchema,
  ImageSchema,
  SchemaDefinition,
} from "./schema"

export interface InterfaceDisplay<
  TProperties extends Readonly<Record<string, AnySchema>>,
> {
  icon?: string
  image?: {
    [TKey in keyof TProperties]: TProperties[TKey] extends ImageSchema
      ? TKey
      : never
  }[keyof TProperties] &
    string
  status?: {
    [TKey in keyof TProperties]: TProperties[TKey] extends EnumSchema
      ? TKey
      : never
  }[keyof TProperties] &
    string
  subtitle?: keyof TProperties & string
  title: keyof TProperties & string
}

export interface InterfaceType<
  TId extends string = string,
  TProperties extends Readonly<Record<string, AnySchema>> = Readonly<
    Record<string, AnySchema>
  >,
> {
  description?: string
  display: {
    icon?: string
    image?: string
    status?: string
    subtitle?: string
    title: string
  }
  id: TId
  kind: "interface"
  name: string
  pluralName: string
  properties: TProperties
}

export interface InterfaceImplementation<
  TInterfaceId extends string = string,
  TProperties extends Readonly<Record<string, string>> = Readonly<
    Record<string, string>
  >,
> {
  interfaceId: TInterfaceId
  properties: TProperties
}

type InterfaceImplementationDefinition<
  TProperties extends Readonly<Record<string, AnySchema>>,
  TInterface extends InterfaceType = InterfaceType,
> = {
  interface: TInterface
  properties: Readonly<
    Record<keyof TInterface["properties"] & string, keyof TProperties & string>
  >
}

export type InterfaceImplementationDefinitions<
  TProperties extends Readonly<Record<string, AnySchema>>,
> = ReadonlyArray<InterfaceImplementationDefinition<TProperties>>

export type BoundInterfaceImplementations<
  TDefinitions extends ReadonlyArray<{
    interface: InterfaceType
    properties: Readonly<Record<string, string>>
  }>,
> = {
  readonly [
    TDefinition in TDefinitions[number] as TDefinition["interface"]["id"]
  ]: InterfaceImplementation<
    TDefinition["interface"]["id"],
    TDefinition["properties"]
  >
}

function compatibleProperty(
  interfaceProperty: AnySchema,
  objectProperty: AnySchema
) {
  if (interfaceProperty.kind !== objectProperty.kind) return false
  const interfaceMetadata: SchemaDefinition = interfaceProperty
  const objectMetadata: SchemaDefinition = objectProperty
  if (interfaceMetadata.nullable !== true && objectMetadata.nullable === true) {
    return false
  }
  if (
    interfaceProperty.kind === "string" &&
    objectProperty.kind === "string" &&
    interfaceProperty.format !== undefined &&
    interfaceProperty.format !== objectProperty.format
  ) {
    return false
  }
  if (
    interfaceProperty.kind === "recordId" &&
    objectProperty.kind === "recordId" &&
    interfaceProperty.typeId !== objectProperty.typeId
  ) {
    return false
  }
  return true
}

export function bindInterfaceImplementations<
  const TDefinitions extends InterfaceImplementationDefinitions<Properties>,
>(
  objectType: string,
  objectProperties: Properties,
  definitions: TDefinitions
): BoundInterfaceImplementations<TDefinitions> {
  const interfaceIds = definitions.map((definition) => definition.interface.id)
  const duplicateInterfaceId = interfaceIds.find(
    (interfaceId, index) => interfaceIds.indexOf(interfaceId) !== index
  )
  if (duplicateInterfaceId !== undefined) {
    throw new Error(
      `Object '${objectType}' implements interface '${duplicateInterfaceId}' more than once.`
    )
  }
  const implementations = Object.fromEntries(
    definitions.map((definition) => {
      const expected = Object.keys(definition.interface.properties)
      const mapped = Object.keys(definition.properties)
      const missing = expected.find(
        (propertyId) => !mapped.includes(propertyId)
      )
      const extra = mapped.find((propertyId) => !expected.includes(propertyId))
      if (missing !== undefined || extra !== undefined) {
        throw new Error(
          `Object '${objectType}' must map exactly the properties of interface '${definition.interface.id}'.`
        )
      }
      for (const [interfacePropertyId, objectPropertyId] of Object.entries(
        definition.properties
      )) {
        const interfaceProperty =
          definition.interface.properties[interfacePropertyId]
        const objectProperty = objectProperties[objectPropertyId]
        if (
          interfaceProperty === undefined ||
          objectProperty === undefined ||
          !compatibleProperty(interfaceProperty, objectProperty)
        ) {
          throw new Error(
            `Object '${objectType}' property '${objectPropertyId}' is not compatible with interface '${definition.interface.id}.${interfacePropertyId}'.`
          )
        }
      }
      return [
        definition.interface.id,
        {
          interfaceId: definition.interface.id,
          properties: definition.properties,
        },
      ]
    })
  )
  // SAFETY: every definition is preserved by interface ID after its complete mapping is validated.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return implementations as BoundInterfaceImplementations<TDefinitions>
}

export function defineInterface<
  const TId extends string,
  const TProperties extends Readonly<Record<string, AnySchema>>,
>(definition: {
  description?: string
  display: InterfaceDisplay<TProperties>
  id: TId
  name: string
  pluralName: string
  properties: TProperties
}): InterfaceType<TId, TProperties> {
  definitionId(definition.id)
  for (const [propertyId, property] of Object.entries(definition.properties)) {
    definitionId(propertyId)
    if (
      Object.hasOwn(property, "default") ||
      property.immutable === true ||
      property.outputOnly === true
    ) {
      throw new Error(
        `Interface '${definition.id}' property '${propertyId}' cannot declare object write behavior.`
      )
    }
  }
  for (const [role, propertyId] of Object.entries(definition.display)) {
    if (role === "icon") {
      definitionId(propertyId)
      continue
    }
    const property = definition.properties[propertyId]
    if (property === undefined) {
      throw new Error(
        `Interface '${definition.id}' display ${role} references unknown property '${propertyId}'.`
      )
    }
    if (role === "image" && property.kind !== "image") {
      throw new Error(
        `Interface '${definition.id}' display image must reference an image property.`
      )
    }
    if (role === "status" && property.kind !== "enum") {
      throw new Error(
        `Interface '${definition.id}' display status must reference an enum property.`
      )
    }
  }

  const value = {
    display: definition.display,
    id: definitionId(definition.id),
    kind: "interface" as const,
    name: definition.name,
    pluralName: definition.pluralName,
    properties: definition.properties,
  }
  return definition.description === undefined
    ? value
    : { ...value, description: definition.description }
}
