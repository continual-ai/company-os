import { Account } from "#/modules/crm/model/account.ts"
import { Contact } from "#/modules/crm/model/contact.ts"
import { Opportunity } from "#/modules/sales/model/opportunity.ts"
import { User } from "#/runtime/access/model/index.ts"
import {
  defineEvent,
  defineLink,
  defineObject,
  schema,
  standardErrors,
  defineAction,
} from "#/runtime/model/index.ts"
import { NoteSubject } from "#/runtime/platform/model/note-subject.ts"

export const Lead = defineObject({
  id: "lead",
  collection: "leads",
  name: "Lead",
  pluralName: "Leads",
  description:
    "A sales inquiry to qualify for an account and contact. Identity details live on the linked CRM records.",
  implements: [{ interface: NoteSubject }],
  properties: {
    name: schema.string({
      label: "Name",
      minLength: 1,
      maxLength: 200,
    }),
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
  },
  search: { fields: ["name"] },
  display: {
    icon: "lead",
    title: "name",
    status: "status",
  },
})
export const ConvertLead = defineAction({
  id: "convert",
  record: Lead,
  name: "Convert lead",
  description:
    "Creates an opportunity using this lead’s account and contact. Retries return the same opportunity.",
  idempotent: true,
  output: {
    opportunity: schema.id(Opportunity),
  },
  errors: [
    standardErrors.aborted,
    standardErrors.alreadyExists,
    standardErrors.failedPrecondition,
  ],
  input: { id: schema.id(Lead) },
})

export const LeadAccount = defineLink({
  id: "leadAccount",
  name: "Lead Account",
  from: { object: Lead, key: "account", label: "Account", min: 1, max: 1 },
  to: { object: Account, key: "leads", label: "Leads" },
})

export const LeadContact = defineLink({
  id: "leadContact",
  name: "Lead contact",
  from: { object: Lead, key: "contact", label: "Contact", min: 1, max: 1 },
  to: { object: Contact, key: "leads", label: "Leads" },
})

export const LeadOpportunity = defineLink({
  outputOnly: true,
  id: "leadOpportunity",
  name: "Converted opportunity",
  from: { object: Lead, key: "opportunity", label: "Opportunity", max: 1 },
  to: { object: Opportunity, key: "sourceLead", label: "Source lead", max: 1 },
})

export const LeadConverted = defineEvent({
  type: "lead.converted",
  version: 1,
  subject: Lead,
  data: schema.object({ opportunity: schema.id(Opportunity) }),
})

export const LeadOwner = defineLink({
  id: "leadOwner",
  name: "Lead owner",
  from: { object: Lead, key: "owner", label: "Owner", max: 1 },
  to: { object: User, key: "leads", label: "Leads" },
})
