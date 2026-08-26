import { defineModel, type RecordIdOf } from "@company/runtime"

import { modelMetadata } from "./metadata"
import { Actor } from "./modules/access/actor"
import type { Identity } from "./modules/access/identity"
import { AccessModule } from "./modules/access/module"
import type { Principal } from "./modules/access/principal"
import { SalesModule } from "./modules/sales/module"
import { Root } from "./root"

export { modelMetadata } from "./metadata"

export const Model = defineModel({
  actor: Actor,
  name: modelMetadata.name,
  modules: [AccessModule, SalesModule],
  root: Root,
})

/** Canonical ID of a durable audit actor in this model. */
export type ActorId = RecordIdOf<typeof Model, typeof Actor>

/** Canonical ID of a local user or service account. */
export type IdentityId = RecordIdOf<typeof Model, typeof Identity>

/** Canonical ID of anything that may receive a role assignment. */
export type PrincipalId = RecordIdOf<typeof Model, typeof Principal>
