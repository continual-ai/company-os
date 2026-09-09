import { enabledModules } from "#/app.config.ts"
import { modelMetadata } from "#/model-metadata.ts"
import { EngineeringModule } from "#/modules/engineering/model/index.ts"
import { MarketingModule } from "#/modules/marketing/model/index.ts"
import { NotesModule } from "#/modules/notes/model/index.ts"
import { SalesModule } from "#/modules/sales/model/index.ts"
import { SupportEngineeringModule } from "#/modules/support-engineering/model/index.ts"
import { SupportModule } from "#/modules/support/model/index.ts"
import { AccessModule, Actor, Root } from "#/runtime/access/model/index.ts"
import type { Identity, Principal } from "#/runtime/access/model/index.ts"
import { AssetsModule } from "#/runtime/assets/model/index.ts"
import {
  defineModel,
  enableModules,
  type RecordIdOf,
} from "#/runtime/model/index.ts"

export { modelMetadata } from "#/model-metadata.ts"

/**
 * Every module is composed and migrated; this is the storage authority. Add a
 * module here, then its server and UI contributions, then enable it in app.config.ts.
 */
export const Model = defineModel({
  actor: Actor,
  root: Root,
  name: modelMetadata.name,
  modules: [
    AccessModule,
    AssetsModule,
    NotesModule,
    SalesModule,
    MarketingModule,
    EngineeringModule,
    SupportModule,
    SupportEngineeringModule,
  ],
})

/** The model the UI, API, MCP tools, and semantic client expose. */
export const EnabledModel = enableModules(Model, enabledModules)

export type ActorId = RecordIdOf<typeof Model, typeof Actor>
export type IdentityId = RecordIdOf<typeof Model, typeof Identity>
export type PrincipalId = RecordIdOf<typeof Model, typeof Principal>
