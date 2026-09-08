import { seedEngineeringDemo } from "@company/engineering/seeds"
import { seedMarketingDemo } from "@company/marketing/seeds"
import { linkSeedRecords } from "@company/runtime/server/seeds"
import { seedSalesDemo } from "@company/sales/seeds"
import { Effect } from "effect"

import { Model } from "#/examples/model.ts"
import { Ticket } from "#/modules/support/model/index.ts"
import { seedSupportDemo } from "#/modules/support/seeds/index.ts"

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
