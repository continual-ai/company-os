import { describe, expect, it } from "vitest"

import { developmentSeedTarget } from "#/app/server/database/db-seed-target.ts"

describe("development seed target", () => {
  it("allows local development and explicitly acknowledged remote branches", () => {
    expect(developmentSeedTarget("postgresql://localhost/company_os")).toBe(
      "localhost/company_os"
    )
    expect(
      developmentSeedTarget(
        "postgresql://branch.example.test/preview",
        "branch.example.test/preview"
      )
    ).toBe("branch.example.test/preview")
  })
  it("rejects production, system databases, and unacknowledged remote targets", () => {
    expect(() =>
      developmentSeedTarget(
        "postgresql://localhost/company_os",
        undefined,
        "production"
      )
    ).toThrow("production")
    expect(() =>
      developmentSeedTarget("postgresql://localhost/postgres")
    ).toThrow("dedicated")
    expect(() =>
      developmentSeedTarget("postgresql://branch.example.test/preview")
    ).toThrow("CONFIRM_DEVELOPMENT_DATABASE")
  })
})
