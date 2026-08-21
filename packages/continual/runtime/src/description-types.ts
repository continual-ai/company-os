import type { Action } from "./definition/action"
import type {
  InterfaceImplementation,
  InterfaceType,
} from "./definition/interface"
import type { LinkType } from "./definition/link"
import type { PropertyDefinition } from "./definition/property"

export const API_DESCRIPTION_VERSION = "0.16" as const

/**
 * Serializable, public description derived from an API contract. Consumers
 * never maintain this projection by hand.
 */
export interface ApiDescription {
  actions: Array<Action>
  api: { id: string; name: string }
  interfaces: Array<InterfaceType>
  links: Array<LinkType>
  objects: Array<{
    collection: string
    description?: string
    display: {
      icon?: string
      image?: string
      status?: string
      subtitle?: string
      title: string
    }
    properties: Record<string, PropertyDefinition>
    id: string
    interfaces: Record<string, InterfaceImplementation>
    name: string
    parent: { kind: "object" | "root"; objectId: string }
    pluralName: string
  }>
  root: { id: "root"; kind: "root"; name: "Root" }
  version: typeof API_DESCRIPTION_VERSION
}
