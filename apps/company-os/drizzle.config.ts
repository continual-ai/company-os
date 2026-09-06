import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "postgresql",
  out: "./src/server/database/migrations",
  schema: "./tools/drizzle-schema.generated.ts",
})
