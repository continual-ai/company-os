import { defineModel, type RecordIdOf } from "@company/runtime"

import { accessDefinitions } from "./access-definitions"
import { crmDefinitions } from "./crm-definitions"
import type { Actor } from "./interfaces/actor"
import type { Identity } from "./interfaces/identity"
import type { Principal } from "./interfaces/principal"
import { modelMetadata } from "./metadata"

export { modelMetadata } from "./metadata"

export const Model = defineModel({
  actor: accessDefinitions.actor,
  name: modelMetadata.name,
  interfaces: [...accessDefinitions.interfaces, ...crmDefinitions.interfaces],
  objects: [...accessDefinitions.objects, ...crmDefinitions.objects],
  links: [...accessDefinitions.links, ...crmDefinitions.links],
  root: accessDefinitions.root,
})

/** Canonical ID of a durable audit actor in this model. */
export type ActorId = RecordIdOf<typeof Model, typeof Actor>

/** Canonical ID of a local user or service account. */
export type IdentityId = RecordIdOf<typeof Model, typeof Identity>

/** Canonical ID of anything that may receive a role assignment. */
export type PrincipalId = RecordIdOf<typeof Model, typeof Principal>
