import { loadLocalEnvironment } from "#/server/local-environment.ts"

loadLocalEnvironment({
  includeExample: !process.argv.includes("--if-configured"),
})
