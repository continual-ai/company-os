import { defineAction, schema } from "@continual/runtime"

import { Company } from "./company"
import { Contact } from "./contact"
import { Lead } from "./lead"

export const QualifyLead = defineAction({
  id: "qualifyLead",
  verb: "qualify",
  name: "Qualify lead",
  description:
    "Idempotently qualifies a lead and creates its company and contact records. Repeating the action returns the existing result.",
  subject: Lead,
  input: schema.object({}),
  output: schema.object({
    leadId: schema.recordId(Lead),
    companyId: schema.recordId(Company),
    contactId: schema.recordId(Contact),
  }),
  errors: [],
})
