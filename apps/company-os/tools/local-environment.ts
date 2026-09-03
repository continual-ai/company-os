import { existsSync } from "node:fs"
import { loadEnvFile } from "node:process"

const projectEnvironmentFile = new URL("../../../.env.local", import.meta.url)
const applicationEnvironmentFile = new URL("../.env.local", import.meta.url)
const legacyEnvironmentFile = new URL("../.env", import.meta.url)
const exampleFile = new URL("../.env.example", import.meta.url)

/** Loads local overrides, then fills missing development values from the example. */
export function loadLocalEnvironment(options?: {
  readonly includeExample?: boolean
}): void {
  for (const file of [
    projectEnvironmentFile,
    applicationEnvironmentFile,
    legacyEnvironmentFile,
  ]) {
    if (existsSync(file)) loadEnvFile(file)
  }
  if (options?.includeExample !== false && existsSync(exampleFile)) {
    loadEnvFile(exampleFile)
  }
}
