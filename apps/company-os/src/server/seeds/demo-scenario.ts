import { Effect } from "effect"

import { seedEngineeringDemo } from "@/modules/engineering/server/demo-seed"
import { seedMarketingDemo } from "@/modules/marketing/server/demo-seed"
import { seedSalesDemo } from "@/modules/sales/server/demo-seed"
import { seedSupportDemo } from "@/modules/support/server/demo-seed"

import type { SeedScenario } from "./run-seed-scenario"

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
