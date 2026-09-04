import { existsSync } from "node:fs"
import { loadEnvFile } from "node:process"

const projectEnvironmentFile = new URL("../../../.env.local", import.meta.url)
const applicationEnvironmentFile = new URL("../.env.local", import.meta.url)
const legacyEnvironmentFile = new URL("../.env", import.meta.url)
const exampleFile = new URL("../.env.example", import.meta.url)

/**
 * Preserves injected environment, then loads App-local, repository-local, legacy,
 * and example values in descending precedence.
 */
export function loadLocalEnvironment(options?: {
  readonly includeExample?: boolean
}): void {
  for (const file of [
    applicationEnvironmentFile,
    projectEnvironmentFile,
    legacyEnvironmentFile,
  ]) {
    if (existsSync(file)) loadEnvFile(file)
  }
  if (options?.includeExample !== false && existsSync(exampleFile)) {
    loadEnvFile(exampleFile)
  }
}
