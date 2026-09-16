import {
  EngineeringModule,
  GitHubConnection,
} from "#/modules/engineering/model/index.ts"
import { ProductModule } from "#/modules/product/model/index.ts"
import { expectModuleStandsAlone } from "#/runtime/testing/module-standalone.ts"

expectModuleStandsAlone(EngineeringModule, [ProductModule], {
  create: (records) =>
    records.repository(GitHubConnection).create({ accountLogin: "example" }),
  absentTable: "accounts",
})
