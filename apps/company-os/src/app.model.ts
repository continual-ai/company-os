import { appMetadata } from "#/app.config.ts"
import { CrmModule } from "#/modules/crm/model/index.ts"
import { EngineeringModule } from "#/modules/engineering/model/index.ts"
import { FeedbackModule } from "#/modules/feedback/model/index.ts"
import { HiringModule } from "#/modules/hiring/model/index.ts"
import { MarketingModule } from "#/modules/marketing/model/index.ts"
import { SalesModule } from "#/modules/sales/model/index.ts"
import { ServiceModule } from "#/modules/service/model/index.ts"
import { WorkDemandModule } from "#/modules/work-demand/model/index.ts"
import { WorkModule } from "#/modules/work/model/index.ts"
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
    CrmModule,
    SalesModule,
    MarketingModule,
    WorkModule,
    EngineeringModule,
    HiringModule,
    ServiceModule,
    FeedbackModule,
    WorkDemandModule,
  ],
})
