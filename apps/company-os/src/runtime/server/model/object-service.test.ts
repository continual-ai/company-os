import { describe, expectTypeOf, it } from "vitest"

import { defineObject } from "#/runtime/model/definition/object.ts"
import { defineRoot } from "#/runtime/model/definition/root.ts"
import { schema } from "#/runtime/model/definition/schema.ts"
import type { ObjectService } from "#/runtime/server/model/object-service.ts"

const Root = defineRoot({ id: "root", name: "Root" })

const Account = defineObject({
  id: "account",
  collection: "accounts",
  name: "Account",
  parent: Root,
  pluralName: "Accounts",
  properties: { name: schema.string() },
  display: { title: "name" },
})

const ReadOnlyAccount = defineObject({
  id: "readOnlyAccount",
  collection: "readOnlyAccounts",
  name: "Read-only account",
  parent: Root,
  pluralName: "Read-only accounts",
  actions: {
    batchDelete: false,
    create: false,
    delete: false,
    update: false,
  },
  properties: { name: schema.string() },
  display: { title: "name" },
})

describe("ObjectService", () => {
  it("omits mutations disabled by the object definition", () => {
    type ReadOnlyService = ObjectService<typeof ReadOnlyAccount>
    expectTypeOf<ReadOnlyService>().toHaveProperty("get")
    expectTypeOf<ReadOnlyService>().toHaveProperty("list")
    expectTypeOf<ReadOnlyService>().toHaveProperty("batchGet")
    expectTypeOf<ReadOnlyService>().not.toHaveProperty("create")
    expectTypeOf<ReadOnlyService>().not.toHaveProperty("update")
    expectTypeOf<ReadOnlyService>().not.toHaveProperty("delete")
    expectTypeOf<ReadOnlyService>().not.toHaveProperty("batchDelete")

    type StandardService = ObjectService<typeof Account>
    expectTypeOf<StandardService>().toHaveProperty("create")
    expectTypeOf<StandardService>().toHaveProperty("update")
    expectTypeOf<StandardService>().toHaveProperty("delete")
    expectTypeOf<StandardService>().toHaveProperty("batchDelete")
  })
})
