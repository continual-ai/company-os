import { expect, it } from "vitest"

import { AccessModule } from "#/runtime/access/model/index.ts"
import { Actor } from "#/runtime/access/model/interfaces/actor.ts"
import { Root } from "#/runtime/access/model/root.ts"
import { defineModel } from "#/runtime/model/index.ts"

it("composes an app with identity and no demo domains", () => {
  const model = defineModel({
    name: "Minimal",
    root: Root,
    actor: Actor,
    modules: [AccessModule],
  })
  expect(Object.keys(model.modules)).toEqual(["access"])
  expect(Object.keys(model.objects)).not.toContain("company")
})
