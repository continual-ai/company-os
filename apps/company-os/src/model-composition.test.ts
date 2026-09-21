import { expect, it } from "vitest"

import { CrmModule } from "#/modules/crm/model/index.ts"
import { CrmUi } from "#/modules/crm/ui/index.ts"
import { FeedbackModule } from "#/modules/feedback/model/index.ts"
import { SalesModule } from "#/modules/sales/model/index.ts"
import { SalesUi } from "#/modules/sales/ui/index.ts"
import { ServiceModule } from "#/modules/service/model/index.ts"
import { ServiceUi } from "#/modules/service/ui/index.ts"
import { WorkDemandModule } from "#/modules/work-demand/model/index.ts"
import { WorkModule } from "#/modules/work/model/index.ts"
import { WorkUi } from "#/modules/work/ui/index.ts"
import { defineModel } from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { composeModelUi } from "#/runtime/ui/model/module-ui.tsx"

const service = [PlatformModule, CrmModule, ServiceModule] as const
it("keeps a business-free starter and allows Service without Work", () => {
  const minimal = defineModel({
    name: "Minimal",
    modules: [PlatformModule],
  })
  expect(Object.keys(minimal.modules)).toEqual(["platform"])
  expect(minimal.objects).toHaveProperty("note")
  expect(minimal.links).toHaveProperty("noteSubjects")
  const standalone = defineModel({
    name: "Service",
    modules: service,
  })
  expect(Object.keys(standalone.objects)).toContain("ticket")
  expect(Object.keys(standalone.objects)).not.toContain("task")
})
it("requires both domains for the feedback module", () => {
  expect(() =>
    defineModel({
      name: "Incomplete",
      modules: [...service, FeedbackModule],
    })
  ).toThrow()
  const dogfood = defineModel({
    name: "Work and service",
    modules: [...service, WorkModule, FeedbackModule],
  })
  expect(dogfood.links.ticketTasks).toBeDefined()
  expect(dogfood.objects.feedback).toBeDefined()
  expect(dogfood.links.feedbackTasks).toBeDefined()
  expect(dogfood.links.feedbackTickets).toBeDefined()
  expect(dogfood.objects).not.toHaveProperty("opportunity")
})

it("composes work demand without requiring customer service", () => {
  const model = defineModel({
    name: "Sales and work",
    modules: [
      PlatformModule,
      CrmModule,
      SalesModule,
      WorkModule,
      WorkDemandModule,
    ],
  })
  expect(model.links.opportunityTasks).toBeDefined()
  expect(model.objects).not.toHaveProperty("ticket")
})

it("composes domain UIs with only their owning model dependencies", () => {
  const crm = defineModel({
    name: "CRM",
    modules: [PlatformModule, CrmModule],
  })
  const work = defineModel({
    name: "Work",
    modules: [PlatformModule, WorkModule],
  })
  const sales = defineModel({
    name: "Sales",
    modules: [PlatformModule, CrmModule, SalesModule],
  })
  const serviceModel = defineModel({ name: "Service", modules: service })
  expect(composeModelUi(crm, CrmUi).account).toBeDefined()
  expect(composeModelUi(work, WorkUi).task).toBeDefined()
  expect(composeModelUi(sales, CrmUi, SalesUi).opportunity).toBeDefined()
  expect(composeModelUi(serviceModel, CrmUi, ServiceUi).ticket).toBeDefined()
})
