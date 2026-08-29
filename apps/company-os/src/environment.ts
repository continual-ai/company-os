import { existsSync } from "node:fs"
import { loadEnvFile } from "node:process"

const environmentFile = new URL("../.env", import.meta.url)

/** Loads local values without overriding environment injected by the runtime. */
export function loadEnvironment(): void {
  if (existsSync(environmentFile)) loadEnvFile(environmentFile)
}
