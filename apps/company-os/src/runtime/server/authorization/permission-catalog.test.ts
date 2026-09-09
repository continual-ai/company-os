import { describe, expect, it } from "vitest"

import { createPermissionCatalog } from "#/runtime/server/authorization/permission-catalog.ts"
import { fixtureModel } from "#/runtime/testing/fixture-model.ts"

const { definedPermissions, objectPermission, permissionDefinition } =
  createPermissionCatalog(fixtureModel)

describe("authorization permission catalog", () => {
  it("defines model operations and application capabilities exactly once", () => {
    expect(definedPermissions).toContain("account.get")
    expect(definedPermissions).toContain("account.list")
    expect(definedPermissions).toContain("account.create")
    expect(definedPermissions).toContain("role.get")
    expect(definedPermissions).not.toContain("role.create")
    expect(definedPermissions).not.toContain("role.update")
    expect(definedPermissions).not.toContain("role.delete")
    expect(definedPermissions).not.toContain("roleAssignment.update")
    expect(definedPermissions).toContain("prospect.convert")
    expect(definedPermissions).toContain("application.develop")
    expect(new Set(definedPermissions).size).toBe(definedPermissions.length)
    expect(() => definedPermissions.map(permissionDefinition)).not.toThrow()
  })

  it("uses one permission for singular and batch forms", () => {
    expect(
      objectPermission({ objectType: "account", operationId: "batchGet" })
    ).toBe("account.get")
    expect(
      objectPermission({ objectType: "account", operationId: "batchDelete" })
    ).toBe("account.delete")
  })
})
