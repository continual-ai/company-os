import { Effect } from "effect"

import { Model } from "#/app.model.ts"
import { seedDevelopmentTeam } from "#/app/seeds/team.server.ts"
import { ModelImplementation } from "#/app/server/application-services.ts"
import { seedEngineeringPerformance } from "#/modules/engineering/seeds/index.ts"
import { seedHiringPerformance } from "#/modules/hiring/seeds/index.ts"
import { seedMarketingPerformance } from "#/modules/marketing/seeds/index.ts"
import { seedSalesPerformance } from "#/modules/sales/seeds/index.ts"
import { seedSupportPerformance } from "#/modules/support/seeds/index.ts"

export function performanceScenario(size: number) {
  if (!Number.isInteger(size) || size < 1 || size > 10000)
    throw new Error("Seed size must be an integer between 1 and 10000.")
  return {
    name: "performance",
    parameters: {
      version: 2,
      size,
      modules: Object.keys(Model.modules).sort().join(","),
    },
    run: Effect.gen(function* () {
      const owners = yield* seedDevelopmentTeam()
      const sales = yield* seedSalesPerformance(size, owners)
      yield* seedHiringPerformance(size, owners)
      yield* seedEngineeringPerformance(sales)
      yield* seedMarketingPerformance(sales)
      const tickets = yield* seedSupportPerformance(sales)
      const { services } = yield* ModelImplementation
      for (const ticket of tickets)
        yield* services.escalation.createIssue({ ticket })
      yield* Effect.log(
        `Prepared ${tickets.length} engineering escalations through the business action.`
      )
    }),
  }
}
