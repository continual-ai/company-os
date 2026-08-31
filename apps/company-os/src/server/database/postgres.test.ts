import { describe, expect, it } from "vitest"

import { assertDatabaseSchemaName, withSearchPath } from "./postgres"

describe("assertDatabaseSchemaName", () => {
  it("accepts conservative identifiers", () => {
    expect(assertDatabaseSchemaName("public")).toBe("public")
    expect(assertDatabaseSchemaName("branch_a1")).toBe("branch_a1")
    expect(assertDatabaseSchemaName("_private")).toBe("_private")
  })

  it("rejects anything that could escape a SQL identifier", () => {
    for (const schema of [
      "",
      "Branch",
      "1branch",
      'a"b',
      "a-b",
      "a b",
      "a;drop schema public",
    ]) {
      expect(() => assertDatabaseSchemaName(schema)).toThrow(/DATABASE_SCHEMA/)
    }
  })
})

describe("withSearchPath", () => {
  it("leaves the URL untouched for the public schema", () => {
    const url = "postgresql://user@127.0.0.1:5432/company_os"
    expect(withSearchPath(url, "public")).toBe(url)
  })

  it("selects the schema through the options startup parameter", () => {
    const result = new URL(
      withSearchPath("postgresql://user@127.0.0.1:5432/company_os", "branch_a")
    )
    expect(result.searchParams.get("options")).toBe(
      "-csearch_path=branch_a,public"
    )
  })

  it("preserves options already present on the URL", () => {
    const result = new URL(
      withSearchPath(
        "postgresql://user@127.0.0.1:5432/company_os?options=-cstatement_timeout%3D5000",
        "branch_a"
      )
    )
    expect(result.searchParams.get("options")).toBe(
      "-cstatement_timeout=5000 -csearch_path=branch_a,public"
    )
  })

  it("rejects invalid schema names before touching the URL", () => {
    expect(() =>
      withSearchPath("postgresql://127.0.0.1:5432/db", 'x";--')
    ).toThrow(/DATABASE_SCHEMA/)
  })
})
