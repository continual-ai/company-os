import { defineInterface, schema } from "#/runtime/model/index.ts"

/** Polymorphic link target for accounts and contacts participating in business activity. */
export const Party = defineInterface({
  id: "party",
  name: "Party",
  pluralName: "Parties",
  description: "An account or contact involved in your business.",
  properties: {
    image: schema.image({ label: "Image", nullable: true }),
    name: schema.string({ label: "Name" }),
  },
  display: {
    icon: "party",
    image: "image",
    title: "name",
  },
})
