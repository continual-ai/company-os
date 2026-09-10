import { expect, expectTypeOf, it } from "vitest"

import {
  type ActorId,
  defineModel,
  type RecordId,
} from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"

it("composes an app with identity and no demo domains", () => {
  const model = defineModel({ name: "Minimal", modules: [PlatformModule] })
  expect(Object.keys(model.modules)).toEqual(["platform"])
  expect(Object.keys(model.objects)).not.toContain("company")
  expect(Object.keys(model.interfaces)).toEqual(["actor", "identity"])
})

it("implements exactly the kernel Actor union", () => {
  const implementers = PlatformModule.objects
    .filter((object) => Object.hasOwn(object.interfaces, "actor"))
    .map((object) => object.id)
  expect(implementers.sort()).toEqual([
    "anonymousActor",
    "serviceAccount",
    "user",
  ])
  expectTypeOf<ActorId>().toEqualTypeOf<
    RecordId<"anonymousActor"> | RecordId<"serviceAccount"> | RecordId<"user">
  >()
})
