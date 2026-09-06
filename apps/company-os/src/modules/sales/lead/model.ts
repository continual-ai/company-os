import {
  defineEvent,
  defineObject,
  schema,
  standardErrors,
} from "@company/runtime"

import { Company } from "#modules/sales/company/model"
import { Contact } from "#modules/sales/contact/model"
import { NoteSubject } from "#modules/sales/interfaces/note-subject"
import { Root } from "#root"

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
  implements: [{ interface: NoteSubject }],
  actions: {
    convert: {
      name: "Convert lead",
      description: "Atomically creates a company and contact from this lead.",
      idempotent: true,
      scope: "object",
      output: {
        company: schema.reference(CompanyReference),
        contact: schema.reference(ContactReference),
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
    convertedCompany: schema.reference(Company, {
      label: "Converted company",
      inverse: { key: "convertedLeads", label: "Converted leads" },
      nullable: true,
      outputOnly: true,
    }),
    convertedContact: schema.reference(Contact, {
      label: "Converted contact",
      inverse: { key: "convertedLeads", label: "Converted leads" },
      nullable: true,
      outputOnly: true,
    }),
    convertedAt: schema.timestamp({
      label: "Converted at",
      nullable: true,
      outputOnly: true,
    }),
  },
  display: {
    icon: "lead",
    title: "name",
    subtitle: "companyName",
    status: "status",
  },
})

export const LeadConverted = defineEvent({
  type: "lead.converted",
  version: 1,
  subject: Lead,
  data: schema.object({
    company: schema.reference(Company),
    contact: schema.reference(Contact),
  }),
})
