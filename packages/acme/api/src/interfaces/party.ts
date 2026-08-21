import { defineInterface, schema } from "@continual/runtime"

/** A company or person that can participate in Acme's business activity. */
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
