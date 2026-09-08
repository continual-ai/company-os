import { EngineeringModule } from "@company/engineering/model"
import { NotesModule } from "@company/notes/model"
import { defineModel } from "@company/runtime/model"
import { AccessModule, Actor, Root } from "@company/runtime/model/access"
import { AssetsModule } from "@company/runtime/model/assets"
import { SalesModule } from "@company/sales/model"
import { expect, it } from "vitest"

import { SupportEngineeringModule } from "#/modules/support-engineering/model/index.ts"
import { SupportModule } from "#/modules/support/model/index.ts"

const support = [
  AccessModule,
  AssetsModule,
  NotesModule,
  SalesModule,
  SupportModule,
] as const
it("keeps a business-free starter and allows Support without Engineering", () => {
  const minimal = defineModel({
    actor: Actor,
    root: Root,
    name: "Minimal",
    modules: [AccessModule, AssetsModule],
  })
  expect(Object.keys(minimal.modules)).toEqual(["access", "assets"])
  const standalone = defineModel({
    actor: Actor,
    root: Root,
    name: "Support",
    modules: support,
  })
  expect(Object.keys(standalone.objects)).toContain("ticket")
  expect(Object.keys(standalone.objects)).not.toContain("issue")
})
it("requires both domains for the optional escalation bridge", () => {
  expect(() =>
    defineModel({
      actor: Actor,
      root: Root,
      name: "Incomplete",
      modules: [...support, SupportEngineeringModule],
    })
  ).toThrow()
  const dogfood = defineModel({
    actor: Actor,
    root: Root,
    name: "Engineering and support",
    modules: [...support, EngineeringModule, SupportEngineeringModule],
  })
  expect(dogfood.objects.escalation.actions.createIssue).toBeDefined()
})
