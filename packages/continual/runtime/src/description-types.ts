import type { Action } from "./definition/action"
import type { InterfaceType } from "./definition/interface"
import type { LinkType } from "./definition/link"
import type { ObjectType } from "./definition/object"
import type { RootType } from "./definition/root"

export const API_DESCRIPTION_VERSION = "0.19" as const

export type ObjectDescription = Omit<ObjectType, "actions" | "kind">

/**
 * Serializable, public description derived from an API contract. Consumers
 * never maintain this projection by hand.
 */
export interface ApiDescription {
  actions: Array<Action>
  api: { id: string; name: string }
  interfaces: Array<InterfaceType>
  links: Array<LinkType>
  objects: Array<ObjectDescription>
  root: RootType
  version: typeof API_DESCRIPTION_VERSION
}
