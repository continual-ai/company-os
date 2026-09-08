import { expect, it } from "vitest"

import { Actor } from "#/model/access/interfaces/actor.ts"
import { AccessModule } from "#/model/access/model.ts"
import { Root } from "#/model/access/root.ts"
import { defineModel } from "#/model/index.ts"

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
