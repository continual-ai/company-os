import { defineObject, schema } from "@continual/runtime"

import { Deal } from "./deal"

export const LineItem = defineObject({
  id: "lineItem",
  collection: "lineItems",
  name: "Line item",
  parent: Deal,
  pluralName: "Line items",
  description: "A priced item owned by a deal.",
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
  display: {
    icon: "lineItem",
    title: "name",
    subtitle: "quantity",
  },
})
