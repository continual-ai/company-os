import { expect, it } from "vitest"

import { CrmModule } from "#/modules/crm/model/index.ts"
import { CrmUi } from "#/modules/crm/ui/index.ts"
import { CustomerFeedbackModule } from "#/modules/customer-feedback/model/index.ts"
import { NotesModule } from "#/modules/notes/model/index.ts"
import { ProductDemandModule } from "#/modules/product-demand/model/index.ts"
import { ProductModule } from "#/modules/product/model/index.ts"
import { ProductUi } from "#/modules/product/ui/index.ts"
import { SalesModule } from "#/modules/sales/model/index.ts"
import { SalesUi } from "#/modules/sales/ui/index.ts"
import { ServiceModule } from "#/modules/service/model/index.ts"
import { ServiceUi } from "#/modules/service/ui/index.ts"
import { defineModel } from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { composeModelUi } from "#/runtime/ui/model/module-ui.tsx"

const service = [PlatformModule, NotesModule, CrmModule, ServiceModule] as const
it("keeps a business-free starter and allows Service without Product", () => {
  const minimal = defineModel({
    name: "Minimal",
    modules: [PlatformModule],
  })
  expect(Object.keys(minimal.modules)).toEqual(["platform"])
  const standalone = defineModel({
    name: "Service",
    modules: service,
  })
  expect(Object.keys(standalone.objects)).toContain("ticket")
  expect(Object.keys(standalone.objects)).not.toContain("issue")
})
it("requires both domains for the optional customer feedback module", () => {
  expect(() =>
    defineModel({
      name: "Incomplete",
      modules: [...service, CustomerFeedbackModule],
    })
  ).toThrow()
  const dogfood = defineModel({
    name: "Product and service",
    modules: [...service, ProductModule, CustomerFeedbackModule],
  })
  expect(dogfood.links.ticketIssues).toBeDefined()
  expect(dogfood.objects).not.toHaveProperty("opportunity")
})

it("composes product demand without requiring customer service", () => {
  const model = defineModel({
    name: "Sales and product",
    modules: [
      PlatformModule,
      NotesModule,
      CrmModule,
      SalesModule,
      ProductModule,
      ProductDemandModule,
    ],
  })
  expect(model.links.opportunityIssues).toBeDefined()
  expect(model.objects).not.toHaveProperty("ticket")
})

it("composes domain UIs with only their owning model dependencies", () => {
  const crm = defineModel({
    name: "CRM",
    modules: [PlatformModule, NotesModule, CrmModule],
  })
  const product = defineModel({
    name: "Product",
    modules: [PlatformModule, NotesModule, ProductModule],
  })
  const sales = defineModel({
    name: "Sales",
    modules: [PlatformModule, NotesModule, CrmModule, SalesModule],
  })
  const serviceModel = defineModel({ name: "Service", modules: service })
  expect(composeModelUi(crm, CrmUi).account).toBeDefined()
  expect(composeModelUi(product, ProductUi).issue).toBeDefined()
  expect(composeModelUi(sales, CrmUi, SalesUi).opportunity).toBeDefined()
  expect(composeModelUi(serviceModel, CrmUi, ServiceUi).ticket).toBeDefined()
})
