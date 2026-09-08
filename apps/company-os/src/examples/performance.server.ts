import { seedSalesPerformance } from "@company/sales/seeds"
import { Effect } from "effect"

import { Model } from "#/examples/model.ts"
import { seedSupportPerformance } from "#/modules/support/seeds/index.ts"

export function performanceScenario(size: number) {
  if (!Number.isInteger(size) || size < 1 || size > 10000)
    throw new Error("Seed size must be an integer between 1 and 10000.")
  return {
    name: "performance",
    parameters: { size, modules: Object.keys(Model.modules).sort().join(",") },
    run: Effect.gen(function* () {
      const sales = yield* seedSalesPerformance(size)
      yield* seedSupportPerformance(sales)
    }),
  }
}
