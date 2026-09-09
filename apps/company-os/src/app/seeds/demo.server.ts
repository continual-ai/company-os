import { Effect } from "effect"

import { Model } from "#/app.model.ts"
import { seedEngineeringDemo } from "#/modules/engineering/seeds/index.ts"
import { seedMarketingDemo } from "#/modules/marketing/seeds/index.ts"
import { seedSalesDemo } from "#/modules/sales/seeds/index.ts"
import { Ticket } from "#/modules/support/model/index.ts"
import { seedSupportDemo } from "#/modules/support/seeds/index.ts"
import { linkSeedRecords } from "#/runtime/server/seeds.ts"

export const demoScenario = {
  name: "demo",
  parameters: { modules: Object.keys(Model.modules).sort().join(",") },
  run: Effect.gen(function* () {
    const customer = yield* seedSalesDemo()
    const engineering = yield* seedEngineeringDemo(customer)
    const support = yield* seedSupportDemo(customer)
    yield* linkSeedRecords(Ticket, "issues", support.ticket, engineering.issue)
    yield* seedMarketingDemo(customer)
  }),
}
