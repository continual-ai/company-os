import type { DefinedAction } from "./definition/action"
import type { FieldDefinition } from "./definition/field"

export const COMPANY_DESCRIPTION_VERSION = "0.6" as const

/**
 * Serializable, public description derived from a company contract. Companies
 * never maintain this projection by hand.
 */
export interface CompanyDescription {
  company: { id: string; name: string }
  modules: Array<{
    actions: Array<DefinedAction>
    id: string
    name: string
    objects: Array<{
      collection: string
      description?: string
      display: {
        image?: string
        status?: string
        subtitle?: string
        title: string
      }
      fields: Record<string, FieldDefinition>
      id: string
      name: string
      operations: {
        batchGet: boolean
        create: boolean
        delete: boolean
        get: boolean
        list: boolean
        update: boolean
      }
      pluralName: string
    }>
  }>
  version: typeof COMPANY_DESCRIPTION_VERSION
}
