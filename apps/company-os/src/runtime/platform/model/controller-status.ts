import { defineQuery, schema } from "#/runtime/model/index.ts"
import { Controller } from "#/runtime/platform/model/controller.ts"

export const ControllerStatus = defineQuery({
  id: "status",
  record: Controller,
  name: "Inspect controller status",
  description:
    "Returns aggregate or per-key diagnostics. An unseen key has state notStarted. Observations are not a host-health guarantee.",
  input: {
    id: schema.id(Controller),
    key: schema.optional(schema.string({ minLength: 1 })),
  },
  output: {
    agentSessionUrl: schema.string({ nullable: true }),
    enabled: schema.boolean(),
    paused: schema.boolean(),
    state: schema.enumeration([
      "notStarted",
      "idle",
      "pending",
      "running",
      "error",
    ]),
    instances: schema.number(),
    runs: schema.number(),
    failures: schema.number(),
    pending: schema.number(),
    running: schema.number(),
    errors: schema.number(),
    lastStartedAt: schema.string({ nullable: true }),
    lastSucceededAt: schema.string({ nullable: true }),
    requeueAt: schema.string({ nullable: true }),
    lastError: schema.string({ nullable: true }),
    lastErrorKey: schema.string({ nullable: true }),
  },
})
