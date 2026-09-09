import { appMetadata, enabledModules } from "#/app.config.ts"
import { EngineeringModule } from "#/modules/engineering/model/index.ts"
import { HiringModule } from "#/modules/hiring/model/index.ts"
import { MarketingModule } from "#/modules/marketing/model/index.ts"
import { NotesModule } from "#/modules/notes/model/index.ts"
import { SalesModule } from "#/modules/sales/model/index.ts"
import { SupportEngineeringModule } from "#/modules/support-engineering/model/index.ts"
import { SupportModule } from "#/modules/support/model/index.ts"
import { AccessModule } from "#/runtime/access/model/index.ts"
import { AssetsModule } from "#/runtime/assets/model/index.ts"
import { defineModel, enableModules } from "#/runtime/model/index.ts"

export type { ActorId } from "#/runtime/model/index.ts"
export type { IdentityId, PrincipalId } from "#/runtime/access/model/ids.ts"

/**
 * Every module is composed and migrated; this is the storage authority. Add a
 * module here, then its server and UI contributions, then enable it in app.config.ts.
 */
export const Model = defineModel({
  name: appMetadata.name,
  modules: [
    AccessModule,
    AssetsModule,
    NotesModule,
    SalesModule,
    MarketingModule,
    EngineeringModule,
    HiringModule,
    SupportModule,
    SupportEngineeringModule,
  ],
})

/** The model the UI, API, MCP tools, and semantic client expose. */
export const EnabledModel = enableModules(Model, enabledModules)
