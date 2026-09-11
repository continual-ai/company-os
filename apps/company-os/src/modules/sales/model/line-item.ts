import { Deal } from "#/modules/sales/model/deal.ts"
import { defineLink, defineObject, schema } from "#/runtime/model/index.ts"

export const LineItem = defineObject({
  id: "lineItem",
  collection: "lineItems",
  name: "Line item",
  pluralName: "Line items",
  description: "A product or service included in a deal.",
  properties: {
    name: schema.string({
      label: "Name",
      minLength: 1,
      maxLength: 200,
    }),
    quantity: schema.number({
      label: "Quantity",
      default: 1,
      integer: true,
      minimum: 1,
    }),
    unitPrice: schema.money({ label: "Unit price", nullable: true }),
  },
  search: { fields: ["name"] },
  display: {
    icon: "lineItem",
    title: "name",
    subtitle: "quantity",
  },
})

export const DealLineItems = defineLink({
  id: "dealLineItems",
  name: "Deal line items",
  from: Deal,
  to: LineItem,
  forward: { key: "lineItems", label: "Line items", onDelete: "cascade" },
  reverse: { key: "deal", label: "Deal", min: 1, max: 1 },
})
