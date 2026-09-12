import { Context, Effect, Layer } from "effect"
import { expect, it } from "vitest"

import {
  defineModel,
  defineModule,
  defineObject,
  schema,
  defineAction,
} from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import {
  defineModuleServer,
  type OperationRequirements,
} from "#/runtime/server/model/module-server.ts"
import { makeServicesLayer } from "#/runtime/server/services.ts"
import { Database } from "#/runtime/server/storage/database.ts"

class Greeting extends Context.Service<Greeting, { readonly value: string }>()(
  "test/Greeting"
) {}
const Item = defineObject({
  id: "item",
  collection: "items",
  name: "Item",
  pluralName: "Items",
  properties: { name: schema.string() },
  display: { title: "name" },
})
const ItemGreet = defineAction({
  id: "greet",
  collection: Item,
  name: "Greet",
  description: "Returns a provider greeting.",
  input: {},
  output: { greeting: schema.string() },
  errors: [],
})
const Module = defineModule({
  id: "items",
  name: "Items",
  objects: [Item],
  interfaces: [],
  links: [],
  actions: [ItemGreet],
})
const greet = Effect.fn(function* (_input: unknown) {
  return { greeting: (yield* Greeting).value }
})
const server = defineModuleServer(
  Module,
  { item: { greet } },
  Layer.succeed(Greeting, { value: "hello" })
)

it("retains custom operation dependencies without creating another container", async () => {
  const implementations = await Effect.runPromise(server.implementations)
  const requirement: Effect.Effect<
    string,
    never,
    OperationRequirements<typeof implementations>
  > = Greeting.pipe(Effect.map((service) => service.value))
  expect(
    await Effect.runPromise(requirement.pipe(Effect.provide(server.layer)))
  ).toBe("hello")
  expect(
    await Effect.runPromise(
      implementations.item.greet({}).pipe(Effect.provide(server.layer))
    )
  ).toEqual({ greeting: "hello" })
})

const model = defineModel({
  name: "Provider test",
  modules: [PlatformModule, Module],
})
const infrastructure = {
  database: Layer.effect(Database, Effect.die("Compile-only provider test")),
}

it("rejects assembly when an operation's service has no provider", () => {
  const unprovided = defineModuleServer(Module, { item: { greet } })
  // @ts-expect-error Greeting is required by the operation and absent from all provider layers.
  const incomplete = makeServicesLayer(model, [unprovided], infrastructure)
  const complete = makeServicesLayer(model, [server], infrastructure)
  expect(incomplete).toBeDefined()
  expect(complete).toBeDefined()
})
