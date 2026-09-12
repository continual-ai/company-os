import { expect, it } from "vitest"

import { EngineeringModule } from "#/modules/engineering/model/index.ts"
import { NotesModule } from "#/modules/notes/model/index.ts"
import { SalesModule } from "#/modules/sales/model/index.ts"
import { SupportEngineeringModule } from "#/modules/support-engineering/model/index.ts"
import { SupportModule } from "#/modules/support/model/index.ts"
import { defineModel } from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"

const support = [
  PlatformModule,
  NotesModule,
  SalesModule,
  SupportModule,
] as const
it("keeps a business-free starter and allows Support without Engineering", () => {
  const minimal = defineModel({
    name: "Minimal",
    modules: [PlatformModule],
  })
  expect(Object.keys(minimal.modules)).toEqual(["platform"])
  const standalone = defineModel({
    name: "Support",
    modules: support,
  })
  expect(Object.keys(standalone.objects)).toContain("ticket")
  expect(Object.keys(standalone.objects)).not.toContain("issue")
})
it("requires both domains for the optional escalation bridge", () => {
  expect(() =>
    defineModel({
      name: "Incomplete",
      modules: [...support, SupportEngineeringModule],
    })
  ).toThrow()
  const dogfood = defineModel({
    name: "Engineering and support",
    modules: [...support, EngineeringModule, SupportEngineeringModule],
  })
  expect(dogfood.actions["ticket.escalate"]).toBeDefined()
})
