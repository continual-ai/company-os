import { describe, expect, it } from "vitest"

import { workerConfigEnv } from "./worker-env"

describe("workerConfigEnv", () => {
  it("projects a direct database URL and other string bindings", () => {
    expect(
      workerConfigEnv({
        APP_SECRET: "secret",
        DATABASE_SCHEMA: "company",
        DATABASE_URL: "postgresql://example.test/company",
      })
    ).toEqual({
      APP_SECRET: "secret",
      DATABASE_MAX_CONNECTIONS: "2",
      DATABASE_SCHEMA: "company",
      DATABASE_URL: "postgresql://example.test/company",
    })
  })

  it("ignores non-string Worker bindings", () => {
    expect(
      workerConfigEnv({
        DATABASE: { connectionString: "postgresql://hyperdrive.invalid/db" },
      })
    ).toEqual({ DATABASE_MAX_CONNECTIONS: "2" })
  })
})
