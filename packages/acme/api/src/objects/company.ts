import { Root, defineObject, schema } from "@continual/runtime"

export const Company = defineObject({
  id: "company",
  collection: "companies",
  name: "Company",
  parent: Root,
  pluralName: "Companies",
  description: "An organization Acme sells to, serves, or partners with.",
  properties: {
    logo: schema.image({ label: "Logo", aspectRatio: 1, nullable: true }),
    name: schema.string({
      label: "Name",
      required: true,
      minLength: 1,
      maxLength: 200,
    }),
    domain: schema.domain({ label: "Domain", maxLength: 253 }),
    website: schema.url({ label: "Website", maxLength: 2_048 }),
    industry: schema.string({ label: "Industry", maxLength: 100 }),
    lifecycleStage: schema.select({
      label: "Lifecycle stage",
      defaultValue: "prospect",
      options: [
        { value: "prospect", label: "Prospect" },
        { value: "customer", label: "Customer" },
        { value: "inactive", label: "Inactive" },
      ],
    }),
  },
  display: {
    image: "logo",
    title: "name",
    subtitle: "domain",
    status: "lifecycleStage",
  },
})
