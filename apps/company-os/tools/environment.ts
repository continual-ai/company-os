import { loadLocalEnvironment } from "#/app/server/local-environment.ts"

loadLocalEnvironment({
  includeExample: !process.argv.includes("--if-configured"),
})
