import { createFileRoute } from "@tanstack/react-router"

// Hosting platforms probe this route for liveness; it must answer without
// touching configuration or upstream services.
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () => Response.json({ ok: true, runtime: "tanstack-start" }),
    },
  },
})
