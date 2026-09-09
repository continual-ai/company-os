import { Campaign, MarketingModule } from "#/modules/marketing/model/index.ts"
import { NotesModule } from "#/modules/notes/model/index.ts"
import { SalesModule } from "#/modules/sales/model/index.ts"
import { expectModuleStandsAlone } from "#/runtime/testing/module-standalone.ts"

expectModuleStandsAlone(MarketingModule, [NotesModule, SalesModule], {
  create: (records) =>
    records.writer(Campaign).create({ name: "Standalone campaign" }),
  absentTable: "issues",
})
