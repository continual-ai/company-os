import { definitionId } from "./identity"
import type { Properties } from "./property"
import type {
  AnySchema,
  EnumSchema,
  ImageSchema,
  SchemaDefinition,
} from "./schema"
import { assertReferencePropertyName } from "./schema"

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
  display?: {
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
  TPropertyMapping extends Readonly<Record<string, string>> = Readonly<
    Record<string, string>
  >,
> {
  interfaceId: TInterfaceId
  propertyMapping: TPropertyMapping
}

type InterfaceImplementationConstraint<
  TProperties extends Readonly<Record<string, AnySchema>>,
  TInterface extends InterfaceType = InterfaceType,
> = keyof TInterface["properties"] extends never
  ? {
      interface: TInterface
      propertyMapping?: never
    }
  : {
      interface: TInterface
      propertyMapping: Readonly<
        Record<
          keyof TInterface["properties"] & string,
          keyof TProperties & string
        >
      >
    }

interface InterfaceImplementationInput {
  interface: InterfaceType
  propertyMapping?: Readonly<Record<string, string>>
}

export type InterfaceImplementationInputs =
  ReadonlyArray<InterfaceImplementationInput>

export type InterfaceImplementationConstraints<
  TProperties extends Readonly<Record<string, AnySchema>>,
  TImplementations extends InterfaceImplementationInputs,
> = {
  readonly [
    TIndex in keyof TImplementations
  ]: TImplementations[TIndex] extends infer TImplementation extends {
    interface: InterfaceType
  }
    ? InterfaceImplementationConstraint<
        TProperties,
        TImplementation["interface"]
      >
    : never
}

export type InterfaceImplementationMap<
  TImplementations extends InterfaceImplementationInputs,
> = {
  readonly [
    TImplementation in TImplementations[number] as TImplementation["interface"]["id"]
  ]: InterfaceImplementation<
    TImplementation["interface"]["id"],
    TImplementation["propertyMapping"] extends Readonly<Record<string, string>>
      ? TImplementation["propertyMapping"]
      : Readonly<Record<never, never>>
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
  const TImplementations extends InterfaceImplementationInputs,
>(
  objectType: string,
  objectProperties: Properties,
  implementations: TImplementations
): InterfaceImplementationMap<TImplementations> {
  const interfaceIds = implementations.map(
    (implementation) => implementation.interface.id
  )
  const duplicateInterfaceId = interfaceIds.find(
    (interfaceId, index) => interfaceIds.indexOf(interfaceId) !== index
  )
  if (duplicateInterfaceId !== undefined) {
    throw new Error(
      `Object '${objectType}' implements interface '${duplicateInterfaceId}' more than once.`
    )
  }
  const implementationMap = Object.fromEntries(
    implementations.map((implementation) => {
      const expected = Object.keys(implementation.interface.properties)
      const propertyMapping = implementation.propertyMapping ?? {}
      const mapped = Object.keys(propertyMapping)
      const missing = expected.find(
        (propertyId) => !mapped.includes(propertyId)
      )
      const extra = mapped.find((propertyId) => !expected.includes(propertyId))
      if (missing !== undefined || extra !== undefined) {
        throw new Error(
          `Object '${objectType}' must map exactly the properties of interface '${implementation.interface.id}'.`
        )
      }
      for (const [interfacePropertyId, objectPropertyId] of Object.entries(
        propertyMapping
      )) {
        const interfaceProperty =
          implementation.interface.properties[interfacePropertyId]
        const objectProperty = objectProperties[objectPropertyId]
        if (
          interfaceProperty === undefined ||
          objectProperty === undefined ||
          !compatibleProperty(interfaceProperty, objectProperty)
        ) {
          throw new Error(
            `Object '${objectType}' property '${objectPropertyId}' is not compatible with interface '${implementation.interface.id}.${interfacePropertyId}'.`
          )
        }
      }
      return [
        implementation.interface.id,
        {
          interfaceId: implementation.interface.id,
          propertyMapping,
        },
      ]
    })
  )
  // SAFETY: every implementation is preserved by interface ID after its complete mapping is validated.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return implementationMap as InterfaceImplementationMap<TImplementations>
}

/**
 * Defines a polymorphic object role that links and other contracts can target
 * without naming one concrete object type. Interfaces without properties are
 * marker capabilities; shared properties require explicit mappings from each
 * implementing object. Object-specific defaults and writes stay on the object.
 */
export function defineInterface<
  const TId extends string,
  const TProperties extends Readonly<Record<string, AnySchema>> = {},
>(definition: {
  description?: string
  display?: InterfaceDisplay<TProperties>
  id: TId
  name: string
  pluralName: string
  properties?: TProperties
}): InterfaceType<TId, TProperties> {
  definitionId(definition.id)
  // SAFETY: omission selects the generic's default empty property map; an
  // explicitly supplied property map is preserved unchanged.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const properties = (definition.properties ?? {}) as TProperties
  for (const [propertyId, property] of Object.entries(properties)) {
    definitionId(propertyId)
    assertReferencePropertyName(
      `Interface '${definition.id}'`,
      propertyId,
      property
    )
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
  for (const [role, propertyId] of Object.entries(definition.display ?? {})) {
    if (role === "icon") {
      definitionId(propertyId)
      continue
    }
    const property = properties[propertyId]
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

  const value: InterfaceType<TId, TProperties> = {
    id: definitionId(definition.id),
    kind: "interface" as const,
    name: definition.name,
    pluralName: definition.pluralName,
    properties,
  }
  if (definition.description !== undefined) {
    value.description = definition.description
  }
  if (definition.display !== undefined) value.display = definition.display
  return value
}
