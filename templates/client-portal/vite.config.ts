import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vite"

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
// Production receives bindings at deploy time; wrangler.jsonc stays empty.
function devVars(): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [name, value] of Object.entries(process.env)) {
    if (value === undefined) continue
    if (name.startsWith("CONTINUAL_") || name.startsWith("VITE_")) {
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

export default defineConfig(({ command, isPreview }) => ({
  resolve: { tsconfigPaths: true },
  plugins: [
    ...(command === "build" || isPreview || workerdDev
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
    tanstackStart(),
    viteReact(),
  ],
  server: {
    allowedHosts: sandboxPreviewHosts,
  },
}))
