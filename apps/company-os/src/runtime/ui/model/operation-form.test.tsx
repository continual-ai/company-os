import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import {
  type ModelCatalog,
  defineAction,
  defineModel,
  defineModule,
  defineObject,
  enableModules,
  schema,
} from "#/runtime/model/index.ts"
import { ModelActions } from "#/runtime/ui/model/operation-action.tsx"
import {
  decodeOperationForm,
  operationFormDefaults,
  operationFormFields,
} from "#/runtime/ui/model/operation-form.ts"
import { ModelUiProvider } from "#/runtime/ui/model/runtime-context.tsx"

const Ticket = defineObject({
  id: "ticket",
  collection: "tickets",
  name: "Ticket",
  pluralName: "Tickets",
  properties: { name: schema.string() },
  display: { title: "name" },
})
const Escalate = defineAction({
  id: "escalate",
  object: Ticket,
  name: "Escalate to engineering",
  description: "Escalate a ticket.",
  input: {
    id: schema.id(Ticket),
    reason: schema.string({ minLength: 1 }),
    notify: schema.optional(schema.boolean()),
    urgency: schema.number({ integer: true }),
    options: schema.object({ team: schema.string() }),
  },
})
const Reconcile = defineAction({
  id: "reconcile",
  collection: Ticket,
  name: "Reconcile tickets",
  description: "Reconcile all tickets.",
})
const Base = defineModule({ id: "base", name: "Base", objects: [Ticket] })
const Extension = defineModule({
  id: "extension",
  name: "Extension",
  objects: [],
  actions: [Escalate, Reconcile],
})
const model = defineModel({ name: "Test", modules: [Base, Extension] })

it("prefills the record target, preserves optional inputs, and validates structured form values", () => {
  expect(
    operationFormFields(Escalate, "external:ticket").map(({ id }) => id)
  ).toEqual(["reason", "notify", "urgency", "options"])
  const defaults = operationFormDefaults(Escalate, "external:ticket")
  const input = decodeOperationForm(
    Escalate,
    {
      ...defaults,
      reason: "Customer blocked",
      urgency: "3",
      options: '{"team":"Engineering"}',
    },
    "external:ticket"
  )
  expect(input).toEqual({
    id: "external:ticket",
    reason: "Customer blocked",
    urgency: 3,
    options: { team: "Engineering" },
  })
  expect(() =>
    decodeOperationForm(
      Escalate,
      { reason: "", urgency: "no", options: "{" },
      "external:ticket"
    )
  ).toThrow()
})
it("shows contributed actions at their attachment and removes them when the owner is disabled", () => {
  const render = (
    active: ModelCatalog,
    recordId?: string,
    exclude?: string[]
  ) =>
    renderToStaticMarkup(
      <ModelUiProvider
        value={{
          model: active,
          data: {},
          ui: {},
          defaultCurrency: "USD",
          uploadAsset: async () => ({ assetId: "unused" }),
        }}
      >
        <ModelActions
          object={Ticket}
          recordId={recordId}
          {...(exclude ? { exclude } : {})}
        />
      </ModelUiProvider>
    )
  expect(render(model, "external:ticket")).toContain("Escalate to engineering")
  expect(render(model)).toContain("Reconcile tickets")
  expect(render(model)).not.toContain("Escalate to engineering")
  expect(render(model, "external:ticket", ["escalate"])).not.toContain(
    "Escalate to engineering"
  )
  expect(
    render(enableModules(model, ["base"]), "external:ticket")
  ).not.toContain("Escalate to engineering")
})
