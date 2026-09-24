/// <reference types="vitest/config" />

import { existsSync } from "node:fs"
import { loadEnvFile } from "node:process"

import { defineConfig } from "@continual/tanstack-start/vite"

export default defineConfig({
  tanstackStart: {
    importProtection: {
      behavior: "error",
      client: {
        files: ["**/server/**", "**/server.ts", "**/*.server.*"],
      },
      server: {
        files: ["**/*.client.*"],
      },
    },
  },
  vite: ({ command, isPreview }) => {
    // The server reads configuration from the process environment; local
    // overrides come from these files, app-level first. Development defaults
    // live in src/app/server/config.ts, not in a file.
    if (command === "serve" && !isPreview)
      for (const file of [".env.local", "../../.env.local"])
        if (existsSync(new URL(file, import.meta.url)))
          loadEnvFile(new URL(file, import.meta.url))

    return {
      ssr: { noExternal: ["react", "react-dom", "use-sync-external-store"] },
      // Use Shiki's portable WASM entry; Nitro's unwasm condition selects a raw file.
      resolve: { alias: { "shiki/wasm": "shiki/dist/wasm.mjs" } },
      server: {
        // A moved port breaks VITE_APP_URL, MCP origin checks, and muscle memory; fail instead.
        strictPort: true,
        allowedHosts: [
          ".tensorlake.ai",
          ".e2b.app",
          ".proxy.daytona.work",
          ".modal.host",
          ...(process.env.CONTINUAL_ALLOWED_DEV_HOSTS?.split(",")
            .map((host) => host.trim())
            .filter(Boolean) ?? []),
        ],
      },
      test: {
        teardownTimeout: 120_000,
        projects: [
          {
            extends: true,
            test: {
              exclude: [
                "src/**/*-database.test.{ts,tsx}",
                "tools/**/*-live.test.ts",
                "tools/**/*.e2e.test.ts",
              ],
              include: ["src/**/*.test.{ts,tsx}", "tools/**/*.test.ts"],
              name: "unit",
            },
          },
          {
            extends: true,
            test: {
              globalSetup: "./src/runtime/testing/global-setup.ts",
              include: ["src/**/*-database.test.ts"],
              hookTimeout: 60_000,
              name: "database",
              testTimeout: 60_000,
            },
          },
          {
            extends: true,
            test: {
              name: "platform-live",
              include: ["tools/platform/*.e2e.test.ts"],
            },
          },
          {
            extends: true,
            test: {
              include: ["tools/agents/*-live.test.ts"],
              name: "agents-live",
              globalSetup: "./src/runtime/testing/global-setup.ts",
              fileParallelism: false,
            },
          },
        ],
      },
    }
  },
})
