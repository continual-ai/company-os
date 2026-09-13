import { Effect } from "effect"

import { Model } from "#/app.model.ts"
import { seedCrmDemo } from "#/modules/crm/seeds/index.ts"
import { seedEngineeringDemo } from "#/modules/engineering/seeds/index.ts"
import { seedMarketingDemo } from "#/modules/marketing/seeds/index.ts"
import { Issue } from "#/modules/product/model/index.ts"
import { seedProductDemo } from "#/modules/product/seeds/index.ts"
import { seedSalesDemo } from "#/modules/sales/seeds/index.ts"
import { Ticket } from "#/modules/service/model/index.ts"
import { seedServiceDemo } from "#/modules/service/seeds/index.ts"
import { linkSeedRecords } from "#/runtime/server/seeds.ts"

export const demoScenario = {
  name: "demo",
  parameters: { modules: Object.keys(Model.modules).sort().join(",") },
  run: Effect.gen(function* () {
    const crm = yield* seedCrmDemo()
    const sales = yield* seedSalesDemo(crm)
    const customer = {
      account: crm.accounts[0].id,
      contact: crm.contacts[0].id,
      owner: crm.owner,
      contacts: crm.contacts.map(({ id }) => id),
    }
    const product = yield* seedProductDemo(customer)
    yield* seedEngineeringDemo(product)
    const support = yield* seedServiceDemo(customer)
    yield* linkSeedRecords(
      Ticket,
      "issues",
      support.ticket,
      product.issues[0].id
    )
    yield* linkSeedRecords(
      Issue,
      "opportunities",
      product.issues[0].id,
      sales.opportunity
    )
    yield* seedMarketingDemo(customer)
  }),
}
