import { Effect } from "effect"

import { Model } from "#/app.model.ts"
import { seedDevelopmentTeam } from "#/app/seeds/team.server.ts"
import { applicationOperations } from "#/app/server/application-services.ts"
import { seedCrmPerformance } from "#/modules/crm/seeds/index.ts"
import { seedHiringPerformance } from "#/modules/hiring/seeds/index.ts"
import { seedMarketingPerformance } from "#/modules/marketing/seeds/index.ts"
import { seedProductPerformance } from "#/modules/product/seeds/index.ts"
import { seedSalesPerformance } from "#/modules/sales/seeds/index.ts"
import { seedServicePerformance } from "#/modules/service/seeds/index.ts"

export function performanceScenario(size: number) {
  if (!Number.isInteger(size) || size < 1 || size > 10000)
    throw new Error("Seed size must be an integer between 1 and 10000.")
  return {
    name: "performance",
    parameters: {
      version: 3,
      size,
      modules: Object.keys(Model.modules).sort().join(","),
    },
    run: Effect.gen(function* () {
      const owners = yield* seedDevelopmentTeam()
      const crm = yield* seedCrmPerformance(size, owners)
      yield* seedSalesPerformance(crm)
      yield* seedHiringPerformance(size, owners)
      const product = yield* seedProductPerformance(crm)
      yield* seedMarketingPerformance(crm)
      const tickets = yield* seedServicePerformance(crm)
      const services = yield* applicationOperations
      for (const [index, ticket] of tickets.entries())
        yield* services.ticket.update({
          id: ticket,
          links: {
            issues: [product.issues[index % product.issues.length]!.id],
          },
        })
      yield* Effect.log(
        `Prepared ${tickets.length} customer reports linked to product work.`
      )
    }),
  }
}
