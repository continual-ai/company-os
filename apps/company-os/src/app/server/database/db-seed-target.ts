/** Local demos are explicit commands; remote databases additionally require an exact target acknowledgment. */
export function developmentSeedTarget(
  databaseUrl: string,
  confirmation?: string,
  environment?: string
) {
  const url = new URL(databaseUrl)
  const name = decodeURIComponent(url.pathname.slice(1))
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    name === "" ||
    ["postgres", "template0", "template1"].includes(name)
  )
    throw new Error(
      "Seeding requires a dedicated PostgreSQL development database."
    )
  if (environment === "production")
    throw new Error("Demo seeding is disabled in production.")
  const target = `${url.hostname}/${name}`
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    confirmation !== target
  )
    throw new Error(
      `Remote seeding requires CONFIRM_DEVELOPMENT_DATABASE=${target}. Use only a disposable development branch.`
    )
  return target
}
