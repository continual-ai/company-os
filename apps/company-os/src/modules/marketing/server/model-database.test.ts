import { CrmModule } from "#/modules/crm/model/index.ts"
import { Campaign, MarketingModule } from "#/modules/marketing/model/index.ts"
import { expectModuleStandsAlone } from "#/runtime/testing/module-standalone.ts"

expectModuleStandsAlone(MarketingModule, [CrmModule], {
  create: (records) =>
    records.repository(Campaign).create({ name: "Standalone campaign" }),
  absentTable: "opportunities",
})
