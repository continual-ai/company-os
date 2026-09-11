import { NoteSubject } from "#/modules/notes/model/index.ts"
import { Company } from "#/modules/sales/model/company.ts"
import { Contact } from "#/modules/sales/model/contact.ts"
import {
  defineEvent,
  defineLink,
  defineObject,
  schema,
  standardErrors,
} from "#/runtime/model/index.ts"

const CompanyReference = { id: "company" } as const
const ContactReference = { id: "contact" } as const

export const Lead = defineObject({
  id: "lead",
  collection: "leads",
  name: "Lead",
  pluralName: "Leads",
  description: "A potential customer to qualify and follow up with.",
  implements: [{ interface: NoteSubject }],
  actions: {
    convert: {
      name: "Convert lead",
      description:
        "Creates a contact and links it to the selected company, or creates a company from the supplied name.",
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
      label: "Company name",
      description:
        "For a new company. Leave blank when linking an existing company.",
      minLength: 1,
      maxLength: 200,
      nullable: true,
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
    convertedAt: schema.timestamp({
      label: "Converted at",
      nullable: true,
      outputOnly: true,
    }),
  },
  search: { fields: ["name", "companyName", "email", "phone"] },
  display: {
    icon: "lead",
    title: "name",
    subtitle: "companyName",
    status: "status",
  },
})

export const LeadCompany = defineLink({
  id: "leadCompany",
  name: "Lead Company",
  from: Lead,
  to: Company,
  forward: { key: "company", label: "Company", max: 1 },
  reverse: { key: "leads", label: "Leads" },
})

export const LeadConvertedCompany = defineLink({
  outputOnly: true,
  id: "leadConvertedCompany",
  name: "Lead Converted company",
  from: Lead,
  to: Company,
  forward: { key: "convertedCompany", label: "Converted company", max: 1 },
  reverse: { key: "convertedLeads", label: "Converted leads" },
})

export const LeadConvertedContact = defineLink({
  outputOnly: true,
  id: "leadConvertedContact",
  name: "Lead Converted contact",
  from: Lead,
  to: Contact,
  forward: { key: "convertedContact", label: "Converted contact", max: 1 },
  reverse: { key: "convertedLeads", label: "Converted leads" },
})

export const LeadConverted = defineEvent({
  type: "lead.converted",
  version: 1,
  subject: Lead,
  data: schema.object({
    company: schema.recordId(Company),
    contact: schema.recordId(Contact),
  }),
})
