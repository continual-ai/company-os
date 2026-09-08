import { Effect } from "effect"

import { seedEngineeringDemo } from "#/modules/engineering/server/demo-seed.ts"
import { seedMarketingDemo } from "#/modules/marketing/server/demo-seed.ts"
import { seedSalesDemo } from "#/modules/sales/server/demo-seed.ts"
import { seedSupportDemo } from "#/modules/support/server/demo-seed.ts"
import type { SeedScenario } from "#/server/seeds/run-seed-scenario.ts"

export const demoScenario = {
  name: "demo",
  parameters: {},
  run: Effect.gen(function* () {
    const customer = yield* seedSalesDemo()
    const engineering = yield* seedEngineeringDemo(customer)
    yield* seedSupportDemo(customer, engineering.issue)
    yield* seedMarketingDemo(customer)
  }),
} satisfies SeedScenario
