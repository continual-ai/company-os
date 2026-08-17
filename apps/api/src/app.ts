import { Hono } from "hono"

import { modelDescription } from "./composition-root"

export const app = new Hono()

app.get("/", (context) =>
  context.json({
    name: "Acme API",
    status: "scaffolded",
    endpoints: ["/health", "/api/model"],
  })
)

app.get("/health", (context) => context.json({ ok: true }))
app.get("/api/model", (context) => context.json(modelDescription))
