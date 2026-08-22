import { defineInterface, schema } from "@continual/runtime"

/** Polymorphic link target for companies and contacts participating in Acme's business activity. */
export const Party = defineInterface({
  id: "party",
  name: "Party",
  pluralName: "Parties",
  description:
    "A polymorphic business participant implemented by companies and contacts.",
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
