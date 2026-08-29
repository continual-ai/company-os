import { describe, expect, it } from "vitest"

import {
  definedPermissions,
  objectPermission,
  permissionDefinition,
} from "./permission-catalog"

describe("authorization permission catalog", () => {
  it("defines model operations and application capabilities exactly once", () => {
    expect(definedPermissions).toContain("company.get")
    expect(definedPermissions).toContain("company.list")
    expect(definedPermissions).toContain("company.create")
    expect(definedPermissions).toContain("role.get")
    expect(definedPermissions).not.toContain("role.create")
    expect(definedPermissions).not.toContain("role.update")
    expect(definedPermissions).not.toContain("role.delete")
    expect(definedPermissions).not.toContain("roleAssignment.update")
    expect(definedPermissions).toContain("lead.convert")
    expect(definedPermissions).toContain("application.develop")
    expect(new Set(definedPermissions).size).toBe(definedPermissions.length)
    expect(() => definedPermissions.map(permissionDefinition)).not.toThrow()
  })

  it("uses one permission for singular and batch forms", () => {
    expect(
      objectPermission({ objectType: "company", operation: "batchGet" })
    ).toBe("company.get")
    expect(
      objectPermission({ objectType: "company", operation: "batchDelete" })
    ).toBe("company.delete")
  })
})
