import { defineObject, field } from "@continual/runtime"

export const Company = defineObject({
  id: "company",
  collection: "companies",
  name: "Company",
  pluralName: "Companies",
  description: "An organization Acme sells to, serves, or partners with.",
  fields: {
    logo: field.image({ label: "Logo", aspectRatio: 1, nullable: true }),
    name: field.text({
      label: "Name",
      required: true,
      minLength: 1,
      maxLength: 200,
    }),
    domain: field.domain({ label: "Domain", maxLength: 253 }),
    website: field.url({ label: "Website", maxLength: 2_048 }),
    industry: field.text({ label: "Industry", maxLength: 100 }),
    lifecycleStage: field.select({
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
