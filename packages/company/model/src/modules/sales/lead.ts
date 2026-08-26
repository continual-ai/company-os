import { defineObject, schema, standardErrors } from "@company/runtime"

import { Root } from "#root"

import { Company } from "./company"
import { Contact } from "./contact"

const CompanyReference = { id: "company" } as const
const ContactReference = { id: "contact" } as const

export const Lead = defineObject({
  id: "lead",
  collection: "leads",
  name: "Lead",
  parent: Root,
  pluralName: "Leads",
  description:
    "An unqualified person or organization that may become a customer.",
  actions: {
    convert: {
      name: "Convert lead",
      description:
        "Atomically creates a company and contact from a qualified lead.",
      idempotent: true,
      scope: "object",
      output: {
        company: schema.recordId(CompanyReference),
        contact: schema.recordId(ContactReference),
      },
      errors: [
        standardErrors.aborted,
        standardErrors.alreadyExists,
        standardErrors.failedPrecondition,
      ],
    },
  },
  properties: {
    name: schema.string({
      label: "Name",
      minLength: 1,
      maxLength: 200,
    }),
    companyName: schema.string({
      label: "Company",
      minLength: 1,
      maxLength: 200,
    }),
    email: schema.email({ label: "Email", maxLength: 320, nullable: true }),
    phone: schema.phone({ label: "Phone", maxLength: 50, nullable: true }),
    source: schema.select({
      label: "Source",
      default: "unknown",
      options: [
        { value: "unknown", label: "Unknown" },
        { value: "inbound", label: "Inbound" },
        { value: "outbound", label: "Outbound" },
        { value: "referral", label: "Referral" },
        { value: "other", label: "Other" },
      ],
    }),
    status: schema.select({
      label: "Status",
      default: "new",
      options: [
        { value: "new", label: "New" },
        { value: "working", label: "Working" },
        { value: "qualified", label: "Qualified" },
        { value: "disqualified", label: "Disqualified" },
      ],
    }),
    convertedCompany: schema.recordId(Company, {
      label: "Converted company",
      immutable: true,
      nullable: true,
    }),
    convertedContact: schema.recordId(Contact, {
      label: "Converted contact",
      immutable: true,
      nullable: true,
    }),
    convertedAt: schema.timestamp({
      label: "Converted at",
      immutable: true,
      nullable: true,
    }),
  },
  display: {
    icon: "lead",
    title: "name",
    subtitle: "companyName",
    status: "status",
  },
})
