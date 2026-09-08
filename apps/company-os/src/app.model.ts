import { defineNotesModule } from "@company/notes/model"
import { defineModel, type RecordIdOf } from "@company/runtime"

import { modelMetadata } from "#/model-metadata.ts"
import { Root } from "#/model-root.ts"
import { Actor } from "#/modules/access/interfaces/actor.ts"
import type { Identity } from "#/modules/access/interfaces/identity.ts"
import type { Principal } from "#/modules/access/interfaces/principal.ts"
import { AccessModule } from "#/modules/access/model.ts"
import { AssetsModule } from "#/modules/assets/model.ts"
import { EngineeringModule } from "#/modules/engineering/model.ts"
import { MarketingModule } from "#/modules/marketing/model.ts"
import { SalesModule } from "#/modules/sales/model.ts"
import { SupportModule } from "#/modules/support/model.ts"

export { modelMetadata } from "#/model-metadata.ts"

export const Model = defineModel({
  actor: Actor,
  name: modelMetadata.name,
  modules: [
    AccessModule,
    SalesModule,
    defineNotesModule(Root),
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
