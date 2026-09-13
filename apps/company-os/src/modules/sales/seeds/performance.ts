import { DateTime, Effect } from "effect"

import { Activity } from "#/modules/crm/model/index.ts"
import type { CrmSeedData } from "#/modules/crm/seeds/index.ts"
import { Note } from "#/modules/notes/model/index.ts"
import { noteSeed } from "#/modules/notes/seeds/index.ts"
import { Lead, Opportunity, LineItem } from "#/modules/sales/model/index.ts"
import {
  type RecordId,
  CalendarDate,
  CurrencyCode,
  Decimal,
  Timestamp,
} from "#/runtime/model/index.ts"
import { Database } from "#/runtime/server/index.ts"
import { linkSeedRecords } from "#/runtime/server/seeds.ts"
const initiatives = [
  "Customer onboarding",
  "Regional rollout",
  "Service renewal",
  "Operations pilot",
  "Partner enablement",
  "Enterprise expansion",
]
export const seedSalesPerformance = Effect.fn("@company/seedSalesPerformance")(
  function* ({ customers }: CrmSeedData) {
    const now = yield* DateTime.now
    const date = (days: number) =>
      CalendarDate(DateTime.formatIso(DateTime.add(now, { days })).slice(0, 10))
    const records = yield* Database
    for (const [index, customer] of customers.entries()) {
      const account = { id: customer.account, name: customer.accountName }
      const contact = { id: customer.contact, name: customer.name }
      const owner = customer.owner
      yield* records.repository(Lead).create({
        name: `${account.name} — initial inquiry`,
        status: (["new", "working", "qualified", "disqualified"] as const)[
          index % 4
        ]!,
        source: (["inbound", "referral", "outbound"] as const)[index % 3]!,
        links: { account: account.id, contact: contact.id, owner },
      })
      const note = yield* records
        .repository(Note)
        .create(noteSeed(index, contact.name))
      let opportunityId: RecordId<"opportunity"> | null = null
      if (index % 2 === 0) {
        const opportunityIndex = index / 2
        const currency = CurrencyCode(
          (["USD", "EUR", "GBP"] as const)[opportunityIndex % 3]!
        )
        const monthlyPrice = 1250 + (opportunityIndex % 20) * 250
        const opportunity = yield* records.repository(Opportunity).create({
          name: `${account.name} — ${initiatives[opportunityIndex % initiatives.length]}`,
          stage: (
            [
              "discovery",
              "qualified",
              "proposal",
              "negotiation",
              "won",
              "lost",
            ] as const
          )[opportunityIndex % 6]!,
          amount:
            opportunityIndex % 11 === 0
              ? null
              : { currency, amount: Decimal(String(monthlyPrice * 12 + 7500)) },
          expectedCloseDate: date((opportunityIndex % 90) - 20),
          nextStep:
            opportunityIndex % 11 === 0
              ? null
              : [
                  "Review rollout scope with the operations team.",
                  "Confirm security requirements and procurement timeline.",
                  "Send the pilot results for sponsor approval.",
                ][opportunityIndex % 3]!,
          nextStepDate: date((opportunityIndex % 21) - 7),
          links: { owner, contacts: [contact.id] },
        })
        opportunityId = opportunity.id
        yield* linkSeedRecords(
          Opportunity,
          "accounts",
          opportunity.id,
          account.id
        )
        yield* linkSeedRecords(Note, "subjects", note.id, opportunity.id)
        for (const item of [
          {
            name: "Managed operations subscription",
            quantity: 12,
            price: monthlyPrice,
          },
          { name: "Implementation and onboarding", quantity: 1, price: 5000 },
          { name: "Team training workshop", quantity: 2, price: 1250 },
        ])
          yield* records.repository(LineItem).create({
            name: item.name,
            quantity: item.quantity,
            unitPrice: { currency, amount: Decimal(String(item.price)) },
            links: { opportunity: opportunity.id },
          })
      }
      const status = (["planned", "planned", "done", "canceled"] as const)[
        index % 4
      ]!
      yield* records.repository(Activity).create({
        title: `${["Review pilot results", "Confirm implementation scope", "Discuss renewal", "Schedule security review", "Follow up on open questions"][index % 5]} — ${account.name}`,
        kind: (["task", "call", "meeting"] as const)[index % 3]!,
        status,
        dueAt: Timestamp(
          DateTime.formatIso(
            DateTime.add(now, {
              days: status === "done" ? -(index % 30) - 1 : (index % 35) - 7,
              hours: index % 8,
            })
          )
        ),
        outcome:
          status === "done"
            ? "Confirmed the next milestone and shared the implementation checklist with the customer."
            : null,
        links: {
          accounts: [account.id],
          contacts: [contact.id],
          opportunities: opportunityId === null ? [] : [opportunityId],
          owner: owner,
        },
      })
    }
  }
)
