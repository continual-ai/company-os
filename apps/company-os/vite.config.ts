/// <reference types="vitest/config" />

import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vite"

import { loadEnvironment } from "./src/environment"

loadEnvironment()

const sandboxPreviewHosts = [
  ".tensorlake.ai",
  ".e2b.app",
  ".proxy.daytona.work",
  ".modal.host",
  ...(process.env.CONTINUAL_ALLOWED_DEV_HOSTS?.split(",")
    .map((host) => host.trim())
    .filter(Boolean) ?? []),
]

// Preview and opted-in workerd dev run the server inside workerd, which only
// sees Worker vars; ordinary Node dev reads the process environment directly.
// Production never gets values this way: the platform supplies bindings at
// deploy time, and the committed wrangler.jsonc stays credential-free.
const devVarNames = [
  "APP_SECRET",
  "CONTINUAL_EXECUTION_TOKEN",
  "CONTINUAL_RUNTIME_ORIGIN",
  "CONTINUAL_RUNTIME_URL",
  "CONTINUAL_URL",
  "DATABASE_SCHEMA",
  "DATABASE_URL",
  "VITE_COMPANY_OS_URL",
]

function devVars(): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [name, value] of Object.entries(process.env)) {
    if (value === undefined) continue
    if (devVarNames.includes(name)) {
      vars[name] = value
    }
  }
  return vars
}

// workerd cannot open outbound database sockets in some sandbox runtimes, so
// ordinary dev serves SSR from Node. Build and preview keep workerd so every
// deploy path still exercises the Worker runtime; CONTINUAL_WORKERD_DEV=1
// opts dev back in for full fidelity.
const workerdDev = process.env.CONTINUAL_WORKERD_DEV === "1"

export default defineConfig(({ command, mode, isPreview }) => ({
  resolve: { tsconfigPaths: true },
  plugins: [
    // The Cloudflare plugin emits dist/server/wrangler.json and the Worker
    // build that `bundle:continual` packages; preview serves that build in
    // workerd. Vitest and ordinary dev run in Node.
    ...(mode !== "test" && (command === "build" || isPreview || workerdDev)
      ? [
          cloudflare({
            viteEnvironment: { name: "ssr" },
            config: (config) =>
              command === "serve"
                ? { vars: { ...config.vars, ...devVars() } }
                : {},
          }),
        ]
      : []),
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
  server: {
    allowedHosts: sandboxPreviewHosts,
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
          globalSetup: "./src/server/database/test-database-global-setup.ts",
          include: ["src/**/*-database.test.ts"],
          name: "database",
          testTimeout: 15_000,
        },
      },
    ],
  },
}))
