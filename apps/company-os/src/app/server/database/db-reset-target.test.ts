import { describe, expect, it } from "vitest"

import { localDatabaseTarget } from "#/app/server/database/db-reset-target.ts"

describe("localDatabaseTarget", () => {
  it("accepts a dedicated local PostgreSQL database", () => {
    expect(
      localDatabaseTarget(
        "postgresql://postgres:secret@127.0.0.1:5432/company_os"
      )
    ).toEqual({ databaseName: "company_os", host: "127.0.0.1" })
  })

  it("refuses a remote database", () => {
    expect(() =>
      localDatabaseTarget(
        "postgresql://postgres:secret@database.example.com/company_os"
      )
    ).toThrow("refuses non-local database host")
  })

  it("requires a database name", () => {
    expect(() => localDatabaseTarget("postgresql://localhost/")).toThrow(
      "dedicated local database"
    )
  })

  it("refuses PostgreSQL maintenance databases", () => {
    for (const name of ["postgres", "template0", "template1"])
      expect(() =>
        localDatabaseTarget(`postgresql://localhost/${name}`)
      ).toThrow("system database")
  })
})
