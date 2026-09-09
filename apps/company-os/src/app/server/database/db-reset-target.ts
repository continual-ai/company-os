const localDatabaseHosts = new Set(["127.0.0.1", "[::1]", "::1", "localhost"])
const systemDatabaseNames = new Set(["postgres", "template0", "template1"])

export interface LocalDatabaseTarget {
  readonly databaseName: string
  readonly host: string
}

/**
 * Refuses to identify anything except a dedicated local PostgreSQL
 * database. The caller may perform destructive work only after this succeeds.
 */
export function localDatabaseTarget(databaseUrl: string): LocalDatabaseTarget {
  let url: URL
  try {
    url = new URL(databaseUrl)
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.")
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("db:reset only supports PostgreSQL URLs.")
  }
  if (!localDatabaseHosts.has(url.hostname)) {
    throw new Error(
      `db:reset refuses non-local database host '${url.hostname}'. Reset remote databases through an explicit recovery procedure.`
    )
  }

  const databaseName = decodeURIComponent(url.pathname.slice(1))
  if (databaseName.length === 0) {
    throw new Error("DATABASE_URL must name a dedicated local database.")
  }
  if (systemDatabaseNames.has(databaseName)) {
    throw new Error(
      `db:reset refuses PostgreSQL system database '${databaseName}'. Use a dedicated local database.`
    )
  }

  return { databaseName, host: url.hostname }
}
