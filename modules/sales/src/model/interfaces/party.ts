import { defineInterface, schema } from "@company/runtime/model"

/** Polymorphic link target for companies and contacts participating in business activity. */
export const Party = defineInterface({
  id: "party",
  name: "Party",
  pluralName: "Parties",
  description: "A company or contact involved in your business.",
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
