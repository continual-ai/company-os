import {
  EngineeringModule,
  Project,
} from "#/modules/engineering/model/index.ts"
import { NotesModule } from "#/modules/notes/model/index.ts"
import { expectModuleStandsAlone } from "#/runtime/testing/module-standalone.ts"

expectModuleStandsAlone(EngineeringModule, [NotesModule], {
  create: (records) =>
    records.writer(Project).create({ name: "Standalone project" }),
  absentTable: "companies",
})
