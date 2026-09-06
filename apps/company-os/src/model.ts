import { defineModel, type RecordIdOf } from "@company/runtime"

import { modelMetadata } from "./model-metadata"
import { Root } from "./model-root"
import { Actor } from "./modules/access/interfaces/actor"
import type { Identity } from "./modules/access/interfaces/identity"
import type { Principal } from "./modules/access/interfaces/principal"
import { AccessModule } from "./modules/access/model"
import { AssetsModule } from "./modules/assets/model"
import { EngineeringModule } from "./modules/engineering/model"
import { MarketingModule } from "./modules/marketing/model"
import { SalesModule } from "./modules/sales/model"
import { SupportModule } from "./modules/support/model"

export { modelMetadata } from "./model-metadata"

export const Model = defineModel({
  actor: Actor,
  name: modelMetadata.name,
  modules: [
    AccessModule,
    SalesModule,
    MarketingModule,
    SupportModule,
    EngineeringModule,
    AssetsModule,
  ],
  root: Root,
})

/** Canonical ID of a durable audit actor in this model. */
export type ActorId = RecordIdOf<typeof Model, typeof Actor>

/** Canonical ID of a local user or service account. */
export type IdentityId = RecordIdOf<typeof Model, typeof Identity>

/** Canonical ID of anything that may receive a role assignment. */
export type PrincipalId = RecordIdOf<typeof Model, typeof Principal>
