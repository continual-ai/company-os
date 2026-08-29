import { describe, expect, it } from "vitest"

import { localDatabaseTarget } from "./db-reset-target"

describe("localDatabaseTarget", () => {
  it("accepts an explicitly confirmed local PostgreSQL database", () => {
    expect(
      localDatabaseTarget(
        "postgresql://postgres:secret@127.0.0.1:5432/company_os",
        "company_os"
      )
    ).toEqual({ databaseName: "company_os", host: "127.0.0.1" })
  })

  it("refuses a remote database", () => {
    expect(() =>
      localDatabaseTarget(
        "postgresql://postgres:secret@database.example.com/company_os",
        "company_os"
      )
    ).toThrow("refuses non-local database host")
  })

  it("requires the database name as confirmation", () => {
    expect(() =>
      localDatabaseTarget(
        "postgresql://postgres:secret@localhost/company_os",
        "wrong_database"
      )
    ).toThrow("CONFIRM_DATABASE_RESET=company_os")
  })

  it("refuses PostgreSQL's default maintenance database", () => {
    expect(() =>
      localDatabaseTarget(
        "postgresql://postgres:secret@localhost/postgres",
        "postgres"
      )
    ).toThrow("refuses PostgreSQL system database 'postgres'")
  })
})
