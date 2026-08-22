import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "postgresql",
  out: "./src/server/database/migrations",
  schema: "./src/server/database/schema.server.ts",
})
