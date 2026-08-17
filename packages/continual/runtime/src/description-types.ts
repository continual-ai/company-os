import type { FieldDefinition } from "./definition/field"

export const COMPANY_DESCRIPTION_VERSION = "0.1" as const

/**
 * Serializable, public description derived from a company contract. Companies
 * never maintain this projection by hand.
 */
export interface CompanyDescription {
  company: { id: string; name: string }
  modules: Array<{
    id: string
    name: string
    objects: Array<{
      description?: string
      display: { status?: string; subtitle?: string; title: string }
      fields: Record<string, FieldDefinition>
      id: string
      name: string
      pluralName: string
    }>
  }>
  version: typeof COMPANY_DESCRIPTION_VERSION
}
