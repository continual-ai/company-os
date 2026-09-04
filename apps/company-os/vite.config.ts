/// <reference types="vitest/config" />

import { defineConfig } from "@continual/tanstack-start/vite"

import { loadLocalEnvironment } from "./tools/local-environment"

export default defineConfig({
  tanstackStart: {
    importProtection: {
      behavior: "error",
      client: {
        files: ["**/server/**"],
      },
      server: {
        files: ["**/*.client.*", "**/client/**"],
      },
    },
  },
  vite: ({ command, mode, isPreview }) => {
    const localDevelopment =
      command === "serve" && mode === "development" && !isPreview
    if (localDevelopment) loadLocalEnvironment()

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
        teardownTimeout: 10_000,
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
              globalSetup:
                "./src/server/database/test-database-global-setup.ts",
              include: ["src/**/*-database.test.ts"],
              name: "database",
              testTimeout: 15_000,
            },
          },
        ],
      },
    }
  },
})
