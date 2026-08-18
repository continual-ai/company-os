import { createFileRoute } from "@tanstack/react-router"

import { contractDescription } from "../../server/composition-root.server"

export const Route = createFileRoute("/api/contract")({
  server: {
    handlers: {
      GET: () => Response.json(contractDescription),
    },
  },
})
