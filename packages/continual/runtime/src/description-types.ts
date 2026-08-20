import type { Action } from "./definition/action"
import type { LinkType } from "./definition/link"
import type { PropertyDefinition } from "./definition/property"

export const API_DESCRIPTION_VERSION = "0.15" as const

/**
 * Serializable, public description derived from an API contract. Consumers
 * never maintain this projection by hand.
 */
export interface ApiDescription {
  actions: Array<Action>
  api: { id: string; name: string }
  links: Array<LinkType>
  objects: Array<{
    collection: string
    description?: string
    display: {
      image?: string
      status?: string
      subtitle?: string
      title: string
    }
    properties: Record<string, PropertyDefinition>
    id: string
    name: string
    parent: { kind: "object" | "root"; objectId: string }
    pluralName: string
  }>
  root: { id: "root"; kind: "root"; name: "Root" }
  version: typeof API_DESCRIPTION_VERSION
}
