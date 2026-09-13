import { Account } from "#/modules/crm/model/account.ts"
import { Contact } from "#/modules/crm/model/contact.ts"
import { NoteSubject } from "#/modules/notes/model/index.ts"
import { defineLink, defineObject, schema } from "#/runtime/model/index.ts"

export const Affiliation = defineObject({
  id: "affiliation",
  collection: "affiliations",
  name: "Affiliation",
  pluralName: "Affiliations",
  description:
    "A person's role at an account. Separate affiliations can represent different roles or periods.",
  implements: [{ interface: NoteSubject }],
  properties: {
    jobTitle: schema.string({
      label: "Job title",
      maxLength: 150,
      nullable: true,
    }),
    startDate: schema.date({ label: "Start date", nullable: true }),
    endDate: schema.date({ label: "End date", nullable: true }),
  },
  checks: {
    dates: {
      left: "startDate",
      operator: "lte",
      right: "endDate",
      message: "End date must be on or after start date.",
    },
  },
  search: { fields: ["jobTitle"] },
  display: {
    title: ["contact.name", "account.name"],
    subtitle: "jobTitle",
    icon: "users",
  },
})

export const AffiliationContact = defineLink({
  id: "affiliationContact",
  from: { type: Affiliation, key: "contact", min: 1, max: 1 },
  to: { type: Contact, key: "affiliations", label: "Affiliations" },
})
export const AffiliationAccount = defineLink({
  id: "affiliationAccount",
  from: { type: Affiliation, key: "account", min: 1, max: 1 },
  to: { type: Account, key: "affiliations", label: "Affiliations" },
})
