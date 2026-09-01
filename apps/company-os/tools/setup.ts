import { constants } from "node:fs"
import { copyFile } from "node:fs/promises"

import { Config, Effect, Option } from "effect"
import { Client } from "pg"

const applicationRoot = new URL("../", import.meta.url)
const environmentFile = new URL(".env", applicationRoot)
const exampleFile = new URL(".env.example", applicationRoot)

// Hosted environments inject configuration through the process environment.
// A .env copied from the example would carry a localhost DATABASE_URL that
// misleads any subprocess not inheriting the injected values, so the file is
// only created where it is the source of truth.
const ambientDatabaseUrl = await Effect.runPromise(
  Config.option(Config.nonEmptyString("DATABASE_URL"))
)

if (Option.isNone(ambientDatabaseUrl)) {
  try {
    await copyFile(exampleFile, environmentFile, constants.COPYFILE_EXCL)
    console.log("Created apps/company-os/.env from .env.example.")
  } catch (error) {
    if (
      !(error instanceof Error && "code" in error && error.code === "EEXIST")
    ) {
      throw error
    }
  }
} else {
  console.log(
    "DATABASE_URL is provided by the environment; skipping .env creation."
  )
}

const { loadEnvironment } = await import("@/environment")
loadEnvironment()

const databaseUrl = await Effect.runPromise(
  Config.nonEmptyString("DATABASE_URL")
)
const target = new URL(databaseUrl)
const databaseName = decodeURIComponent(target.pathname.slice(1))
const localHostnames = new Set(["127.0.0.1", "[::1]", "localhost"])

if (databaseName.length === 0) {
  throw new Error("DATABASE_URL must include a database name.")
}

if (localHostnames.has(target.hostname) && databaseName !== "postgres") {
  const adminUrl = new URL(target)
  adminUrl.pathname = "/postgres"
  const client = new Client({ connectionString: adminUrl.toString() })
  try {
    await client.connect()
    const existing = await client.query<{ exists: boolean }>(
      "select exists(select from pg_database where datname = $1)",
      [databaseName]
    )
    if (!existing.rows[0]?.exists) {
      const identifier = `"${databaseName.replaceAll('"', '""')}"`
      await client.query(`create database ${identifier}`)
      console.log(`Created local PostgreSQL database '${databaseName}'.`)
    }
  } finally {
    await client.end().catch(() => undefined)
  }
}
