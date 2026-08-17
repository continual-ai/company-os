import { serve } from "@hono/node-server"

import { app } from "./app"

const port = Number(process.env.PORT ?? 4000)

serve({ fetch: app.fetch, port }, ({ port: listeningPort }) => {
  console.log(`Acme API listening on http://localhost:${listeningPort}`)
})
