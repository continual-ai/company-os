import { EngineeringModule } from "#/modules/engineering/model/index.ts"
import { Repository } from "#/modules/engineering/model/index.ts"
import { NotesModule } from "#/modules/notes/model/index.ts"
import { ProductModule } from "#/modules/product/model/index.ts"
import { expectModuleStandsAlone } from "#/runtime/testing/module-standalone.ts"

expectModuleStandsAlone(EngineeringModule, [NotesModule, ProductModule], {
  create: (records) =>
    records.repository(Repository).create({ name: "Standalone repository" }),
  absentTable: "accounts",
})
