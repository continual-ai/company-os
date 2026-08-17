import { Hono } from "hono"

import { contractDescription } from "./composition-root"

export const app = new Hono()

app.get("/", (context) =>
  context.json({
    name: "Acme Company API",
    status: "scaffolded",
    endpoints: ["/health", "/api/contract"],
  })
)

app.get("/health", (context) => context.json({ ok: true }))
app.get("/api/contract", (context) => context.json(contractDescription))
