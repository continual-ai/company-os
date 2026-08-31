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

// Dev and preview run the server inside workerd, which only sees Worker vars.
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

export default defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
  plugins: [
    cloudflare({
      viteEnvironment: { name: "ssr" },
      config: (config) =>
        command === "serve" ? { vars: { ...config.vars, ...devVars() } } : {},
    }),
    devtools(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  server: {
    allowedHosts: sandboxPreviewHosts,
  },
}))
