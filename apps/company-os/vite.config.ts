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
      server: {
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
              exclude: ["src/**/*-database.test.{ts,tsx}"],
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
        ],
      },
    }
  },
})
