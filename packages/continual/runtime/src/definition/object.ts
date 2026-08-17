import type { Fields } from "./field"
import { definitionId } from "./identity"

export interface ObjectDisplay<TFields extends Fields> {
  status?: keyof TFields & string
  subtitle?: keyof TFields & string
  title: keyof TFields & string
}

export interface DefinedObject<TFields extends Fields = Fields> {
  description?: string
  display: {
    status?: string
    subtitle?: string
    title: string
  }
  fields: TFields
  id: string
  kind: "object"
  name: string
  pluralName: string
}

export function defineObject<const TFields extends Fields>(definition: {
  description?: string
  display: ObjectDisplay<TFields>
  fields: TFields
  id: string
  name: string
  pluralName: string
}): DefinedObject<TFields> {
  return {
    kind: "object",
    ...definition,
    id: definitionId(definition.id),
  }
}
