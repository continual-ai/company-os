import { Effect } from "effect"

import { seedSalesPerformance } from "@/modules/sales/server/performance-seed"
import { seedSupportPerformance } from "@/modules/support/server/performance-seed"

import type { SeedScenario } from "./run-seed-scenario"

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
