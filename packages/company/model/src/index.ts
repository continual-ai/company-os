import { defineModel, type RecordIdOf } from "@company/runtime"

import { companyComposition } from "./company-composition"
import { foundation } from "./foundation"
import type { Actor } from "./interfaces/actor"
import type { Identity } from "./interfaces/identity"
import type { Principal } from "./interfaces/principal"
import { modelMetadata } from "./metadata"

export { modelMetadata } from "./metadata"

export const Model = defineModel({
  actor: foundation.actor,
  id: "operatingSystem",
  name: modelMetadata.name,
  interfaces: foundation.interfaces,
  objects: [...foundation.objects, ...companyComposition.objects],
  links: [...foundation.links, ...companyComposition.links],
  root: foundation.root,
})

/** Canonical ID of a durable audit actor in this model. */
export type ActorId = RecordIdOf<typeof Model, typeof Actor>

/** Canonical ID of a local user or service account. */
export type IdentityId = RecordIdOf<typeof Model, typeof Identity>

/** Canonical ID of anything that may receive a role assignment. */
export type PrincipalId = RecordIdOf<typeof Model, typeof Principal>
