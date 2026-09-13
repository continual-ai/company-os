import { Effect } from "effect"

import { Account, Contact } from "#/modules/crm/model/index.ts"
import { Lead, LeadConverted } from "#/modules/sales/model/lead.ts"
import { Opportunity } from "#/modules/sales/model/opportunity.ts"
import { User } from "#/runtime/access/model/index.ts"
import type { ObjectGetInput } from "#/runtime/model/index.ts"
import { linkedId } from "#/runtime/model/record-links.ts"
import { Database, EventJournal } from "#/runtime/server/index.ts"

export const convertLead = Effect.fn("lead.convert")(function* (
  input: ObjectGetInput<typeof Lead>
) {
  const database = yield* Database
  const events = yield* EventJournal
  const leads = database.repository(Lead)
  const lead = yield* leads.get(input)
  const existing = linkedId(lead, "opportunity", Opportunity)
  if (existing !== null) return { opportunity: existing }
  const account = linkedId(lead, "account", Account)!
  const contact = linkedId(lead, "contact", Contact)!
  if (lead.status === "disqualified") {
    return yield* Effect.fail({
      status: "FAILED_PRECONDITION" as const,
      reason: "FAILED_PRECONDITION" as const,
      message: "Reopen the disqualified lead before converting it.",
    })
  }
  const opportunity = yield* database.repository(Opportunity).create({
    name: lead.name,
    stage: "qualified",
    links: {
      accounts: [account],
      contacts: [contact],
      owner: linkedId(lead, "owner", User),
    },
  })
  // The executor transaction rolls back the opportunity if another conversion wins the etag check.
  yield* leads.update({
    id: lead.id,
    etag: lead.etag,
    status: "qualified",
    links: { opportunity: opportunity.id },
  })
  yield* events.append(LeadConverted, {
    subject: lead.id,
    data: { opportunity: opportunity.id },
  })
  return { opportunity: opportunity.id }
})
