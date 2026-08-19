import type { DefinedAction } from "./definition/action"
import type { FieldDefinition } from "./definition/field"

export const API_DESCRIPTION_VERSION = "0.7" as const

/**
 * Serializable, public description derived from an API contract. Consumers
 * never maintain this projection by hand.
 */
export interface ApiDescription {
  api: { id: string; name: string }
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
  version: typeof API_DESCRIPTION_VERSION
}
