import { createFileRoute } from "@tanstack/react-router"

// Hosting platforms probe this route for liveness, so it must answer without
// touching configuration or the database; /health remains the readiness check.
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () => Response.json({ ok: true, runtime: "tanstack-start" }),
    },
  },
})
