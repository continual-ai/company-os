import { defineObject, schema } from "@company/runtime"

import { AuthorizationScope } from "#interfaces/authorization-scope"
import { Party } from "#interfaces/party"
import { Platform } from "#platform"

export const Company = defineObject({
  id: "company",
  collection: "companies",
  name: "Company",
  parent: Platform,
  pluralName: "Companies",
  description: "An organization that is a customer, prospect, or partner.",
  implements: [
    { interface: AuthorizationScope },
    {
      interface: Party,
      propertyMapping: { image: "logo", name: "name" },
    },
  ],
  properties: {
    name: schema.string({
      label: "Name",
      minLength: 1,
      maxLength: 200,
    }),
    logo: schema.image({ label: "Logo", aspectRatio: 1, nullable: true }),
    domain: schema.domain({
      label: "Domain",
      maxLength: 253,
      nullable: true,
    }),
    website: schema.url({
      label: "Website",
      maxLength: 2_048,
      nullable: true,
    }),
    industry: schema.string({
      label: "Industry",
      maxLength: 100,
      nullable: true,
    }),
    lifecycleStage: schema.select({
      label: "Lifecycle stage",
      default: "prospect",
      options: [
        { value: "prospect", label: "Prospect" },
        { value: "customer", label: "Customer" },
        { value: "inactive", label: "Inactive" },
      ],
    }),
  },
  display: {
    icon: "building",
    image: "logo",
    title: "name",
    subtitle: "domain",
    status: "lifecycleStage",
  },
})
