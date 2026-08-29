/// <reference types="vitest/config" />

import tailwindcss from "@tailwindcss/vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vite"

import { loadEnvironment } from "./src/environment"

loadEnvironment()

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
        },
        server: {
          files: ["**/*.client.*", "**/client/**"],
        },
      },
    }),
    viteReact(),
  ],
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
          globalSetup: "./src/server/database/test-database-global-setup.ts",
          include: ["src/**/*-database.test.ts"],
          name: "database",
          testTimeout: 15_000,
        },
      },
    ],
  },
})
