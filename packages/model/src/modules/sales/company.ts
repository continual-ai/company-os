import { defineObject, schema } from "@company/runtime"

import { AuthorizationScope } from "#modules/access/authorization-scope"
import { Root } from "#root"

import { NoteSubject } from "./note-subject"
import { Party } from "./party"

export const Company = defineObject({
  id: "company",
  collection: "companies",
  name: "Company",
  parent: Root,
  pluralName: "Companies",
  description: "An organization that is a customer, prospect, or partner.",
  implements: [
    { interface: AuthorizationScope },
    { interface: NoteSubject },
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
    industry: schema.select({
      label: "Industry",
      nullable: true,
      options: [
        { value: "SaaS/Technology", label: "SaaS / technology" },
        { value: "Professional services", label: "Professional services" },
        { value: "Financial services", label: "Financial services" },
        { value: "Healthcare", label: "Healthcare" },
        { value: "Manufacturing", label: "Manufacturing" },
        { value: "Retail", label: "Retail" },
        {
          value: "Media/Telecommunications",
          label: "Media / telecommunications",
        },
        { value: "Education", label: "Education" },
        { value: "Government", label: "Government" },
        { value: "Nonprofit", label: "Nonprofit" },
        { value: "Other", label: "Other" },
      ],
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
