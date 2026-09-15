import {
  defineAction,
  defineEvent,
  schema,
  standardErrors,
} from "#/runtime/model/index.ts"
import { Controller } from "#/runtime/platform/model/controller.ts"

export const ReconcileController = defineAction({
  id: "reconcile",
  object: Controller,
  name: "Reconcile controller",
  description:
    "Durably requests reconciliation of a record, or every current key when key is omitted. Returns after acceptance, not completion. Requests may coalesce; reconcilers must tolerate repeated execution.",
  input: {
    id: schema.id(Controller),
    key: schema.optional(schema.string({ minLength: 1 })),
  },
  output: { accepted: schema.boolean() },
  errors: [standardErrors.failedPrecondition],
})

export const ControllerReconciliationRequested = defineEvent({
  type: "controller.reconciliationRequested",
  version: 1,
  subject: Controller,
  data: schema.object({
    key: schema.string({ nullable: true }),
  }),
})
