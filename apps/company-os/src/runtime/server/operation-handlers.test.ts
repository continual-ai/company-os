import type { Effect } from "effect"
import { describe, expectTypeOf, it } from "vitest"

import {
  type ObjectCreateInput,
  type ObjectUpdateInput,
  defineObject,
} from "#/runtime/model/definition/object.ts"
import { schema } from "#/runtime/model/definition/schema.ts"
import { defineModel, defineModule } from "#/runtime/model/index.ts"
import type { CurrentInvocation } from "#/runtime/server/invocation.ts"
import type { OperationServices } from "#/runtime/server/operation-handlers.ts"
import type { fixtureModel, Person } from "#/runtime/testing/fixture-model.ts"

const Account = defineObject({
  id: "account",
  collection: "accounts",
  name: "Account",
  pluralName: "Accounts",
  properties: { name: schema.string() },
  display: { title: "name" },
})

const ReadOnlyAccount = defineObject({
  id: "readOnlyAccount",
  collection: "readOnlyAccounts",
  name: "Read-only account",
  pluralName: "Read-only accounts",
  actions: { batchDelete: false, create: false, delete: false, update: false },
  properties: { name: schema.string() },
  display: { title: "name" },
})

const Model = defineModel({
  name: "Operation types",
  modules: [
    defineModule({
      id: "test",
      name: "Test",
      objects: [Account, ReadOnlyAccount],
    }),
  ],
})
describe("OperationServices", () => {
  it("omits mutations disabled by the object definition", () => {
    type ReadOnlyService = OperationServices<typeof Model>["readOnlyAccount"]
    expectTypeOf<ReadOnlyService>().toHaveProperty("get")
    expectTypeOf<ReadOnlyService>().toHaveProperty("list")
    expectTypeOf<ReadOnlyService>().toHaveProperty("batchGet")
    expectTypeOf<ReadOnlyService>().not.toHaveProperty("create")
    expectTypeOf<ReadOnlyService>().not.toHaveProperty("update")
    expectTypeOf<ReadOnlyService>().not.toHaveProperty("delete")
    expectTypeOf<ReadOnlyService>().not.toHaveProperty("batchDelete")

    type StandardService = OperationServices<typeof Model>["account"]
    expectTypeOf<StandardService>().toHaveProperty("create")
    expectTypeOf<StandardService>().toHaveProperty("update")
    expectTypeOf<StandardService>().toHaveProperty("delete")
    expectTypeOf<StandardService>().toHaveProperty("batchDelete")
  })
})

it("preserves model-aware write inputs and tagged read failures for domain callers", () => {
  type Service = OperationServices<typeof fixtureModel>["person"]
  expectTypeOf<Parameters<Service["create"]>[0]>().toEqualTypeOf<
    ObjectCreateInput<typeof Person, typeof fixtureModel>
  >()
  expectTypeOf<Parameters<Service["update"]>[0]>().toEqualTypeOf<
    ObjectUpdateInput<typeof Person, typeof fixtureModel>
  >()
  type Failure = Effect.Error<ReturnType<Service["get"]>>
  expectTypeOf<Extract<Failure, { _tag: "ObjectNotFound" }>>().not.toBeNever()
  expectTypeOf<Failure>().not.toBeUnknown()
})

it("retains invocation requirements and boundary failures on every generated read", () => {
  type Service = OperationServices<typeof fixtureModel>["person"]
  expectTypeOf<
    Effect.Services<ReturnType<Service["get"]>>
  >().toEqualTypeOf<CurrentInvocation>()
  expectTypeOf<
    Effect.Services<ReturnType<Service["list"]>>
  >().toEqualTypeOf<CurrentInvocation>()
  expectTypeOf<
    Effect.Services<ReturnType<Service["batchGet"]>>
  >().toEqualTypeOf<CurrentInvocation>()
  type Failure = Effect.Error<ReturnType<Service["get"]>>
  expectTypeOf<
    Extract<Failure, { _tag: "ProjectAccessRequired" }>
  >().not.toBeNever()
})
