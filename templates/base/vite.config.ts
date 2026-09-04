import { defineConfig } from "@continual/tanstack-start/vite"

const sandboxPreviewHosts = [
  ".tensorlake.ai",
  ".e2b.app",
  ".proxy.daytona.work",
  ".modal.host",
  ...(process.env.CONTINUAL_ALLOWED_DEV_HOSTS?.split(",")
    .map((host) => host.trim())
    .filter(Boolean) ?? []),
]

export default defineConfig({
  vite: {
    server: {
      allowedHosts: sandboxPreviewHosts,
    },
  },
})
