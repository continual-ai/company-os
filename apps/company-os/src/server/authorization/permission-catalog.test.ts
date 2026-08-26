import { describe, expect, it } from "vitest"

import {
  modelPermissions,
  objectPermission,
  permissionDefinition,
} from "./permission-catalog"

describe("authorization permission catalog", () => {
  it("derives only operations enabled by the model", () => {
    expect(modelPermissions).toContain("company.get")
    expect(modelPermissions).toContain("company.list")
    expect(modelPermissions).toContain("company.create")
    expect(modelPermissions).toContain("role.get")
    expect(modelPermissions).not.toContain("role.create")
    expect(modelPermissions).not.toContain("role.update")
    expect(modelPermissions).not.toContain("role.delete")
    expect(modelPermissions).not.toContain("roleAssignment.update")
    expect(modelPermissions).toContain("lead.convert")
    expect(new Set(modelPermissions).size).toBe(modelPermissions.length)
    expect(() => modelPermissions.map(permissionDefinition)).not.toThrow()
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
