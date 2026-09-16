import { Opportunity } from "#/modules/sales/model/opportunity.ts"
import { defineLink, defineObject, schema } from "#/runtime/model/index.ts"

export const LineItem = defineObject({
  id: "lineItem",
  collection: "lineItems",
  name: "Line item",
  pluralName: "Line items",
  description: "A product or service included in a opportunity.",
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

export const OpportunityLineItems = defineLink({
  id: "opportunityLineItems",
  name: "Opportunity line items",
  from: {
    object: Opportunity,
    key: "lineItems",
    label: "Line items",
    onDelete: "cascade",
  },
  to: {
    object: LineItem,
    key: "opportunity",
    label: "Opportunity",
    min: 1,
    max: 1,
  },
})
