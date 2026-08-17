import type { FieldDefinition } from "./definitions/field"

export const MODEL_DESCRIPTION_VERSION = "0.1" as const

/**
 * Serializable, public description of a Company Model. Runtimes derive this
 * value from the registered definitions; projects never maintain it by hand.
 */
export interface ModelDescription {
  apps: Array<{
    id: string
    name: string
    source: string
    type: string
  }>
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
  project: { id: string; name: string }
  version: typeof MODEL_DESCRIPTION_VERSION
}
