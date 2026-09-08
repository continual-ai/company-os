import { defineModel, type RecordIdOf } from "@company/runtime/model"
import { Actor, AccessModule, Root } from "@company/runtime/model/access"
import type { Identity, Principal } from "@company/runtime/model/access"
import { AssetsModule } from "@company/runtime/model/assets"

import { modelMetadata } from "#/model-metadata.ts"

export { modelMetadata } from "#/model-metadata.ts"

/** The installed model. Add business modules here, then their server and UI contributions. */
export const Model = defineModel({
  actor: Actor,
  root: Root,
  name: modelMetadata.name,
  modules: [AccessModule, AssetsModule],
})
export type ActorId = RecordIdOf<typeof Model, typeof Actor>
export type IdentityId = RecordIdOf<typeof Model, typeof Identity>
export type PrincipalId = RecordIdOf<typeof Model, typeof Principal>
