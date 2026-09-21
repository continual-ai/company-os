import { Effect } from "effect"

import { EngineeringModule } from "#/modules/engineering/model/index.ts"
import { WorkModule } from "#/modules/work/model/index.ts"
import { Connection } from "#/runtime/platform/model/connection.ts"
import { connectorAlias } from "#/runtime/platform/model/connector.ts"
import { seedModuleSettings } from "#/runtime/platform/server/seed.ts"
import { expectModuleStandsAlone } from "#/runtime/testing/module-standalone.ts"

expectModuleStandsAlone(EngineeringModule, [WorkModule], {
  create: (records) =>
    seedModuleSettings().pipe(
      Effect.andThen(
        records.repository(Connection).create({
          account: "example",
          links: { connector: connectorAlias("github") },
        })
      )
    ),
  absentTable: "accounts",
})
