import { constants } from "node:fs"
import { copyFile } from "node:fs/promises"

import { Config, Effect } from "effect"
import { Client } from "pg"

const applicationRoot = new URL("../", import.meta.url)
const environmentFile = new URL(".env", applicationRoot)
const exampleFile = new URL(".env.example", applicationRoot)

try {
  await copyFile(exampleFile, environmentFile, constants.COPYFILE_EXCL)
  console.log("Created apps/company-os/.env from .env.example.")
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) {
    throw error
  }
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
  const client = new Client({
    connectionString: adminUrl.toString(),
    connectionTimeoutMillis: 5_000,
  })
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
  } catch (cause) {
    throw new Error(
      "Could not prepare the local PostgreSQL database. Ensure DATABASE_URL reaches PostgreSQL and the configured role can create the database.",
      { cause }
    )
  } finally {
    await client.end().catch(() => undefined)
  }
}
