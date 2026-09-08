import { Effect } from "effect"

import { seedSalesPerformance } from "#/modules/sales/server/performance-seed.ts"
import { seedSupportPerformance } from "#/modules/support/server/performance-seed.ts"
import type { SeedScenario } from "#/server/seeds/run-seed-scenario.ts"

export function performanceScenario(size: number): SeedScenario {
  if (!Number.isInteger(size) || size < 1 || size > 10000)
    throw new Error("Seed size must be an integer between 1 and 10000.")
  return {
    name: "performance",
    parameters: { size },
    run: Effect.gen(function* () {
      const sales = yield* seedSalesPerformance(size)
      yield* seedSupportPerformance(sales)
    }),
  }
}
