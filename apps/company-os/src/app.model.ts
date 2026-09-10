import { appMetadata } from "#/app.config.ts"
import { EngineeringModule } from "#/modules/engineering/model/index.ts"
import { HiringModule } from "#/modules/hiring/model/index.ts"
import { MarketingModule } from "#/modules/marketing/model/index.ts"
import { NotesModule } from "#/modules/notes/model/index.ts"
import { SalesModule } from "#/modules/sales/model/index.ts"
import { SupportEngineeringModule } from "#/modules/support-engineering/model/index.ts"
import { SupportModule } from "#/modules/support/model/index.ts"
import { defineModel } from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"

export type { ActorId } from "#/runtime/model/index.ts"
export type { IdentityId } from "#/runtime/access/model/ids.ts"

/**
 * Every module is composed and migrated; this is the storage authority. Add a
 * module here, then its server and UI contributions, then enable it in Settings > Platform > Modules.
 */
export const Model = defineModel({
  name: appMetadata.name,
  maintainer: appMetadata.maintainer,
  modules: [
    PlatformModule,
    NotesModule,
    SalesModule,
    MarketingModule,
    EngineeringModule,
    HiringModule,
    SupportModule,
    SupportEngineeringModule,
  ],
})
