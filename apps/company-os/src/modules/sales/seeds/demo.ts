import { DateTime, Effect } from "effect"

import { Activity } from "#/modules/crm/model/activity.ts"
import type { CrmDemoData } from "#/modules/crm/seeds/index.ts"
import { Lead } from "#/modules/sales/model/lead.ts"
import { Opportunity } from "#/modules/sales/model/opportunity.ts"
import { CurrencyCode, Decimal, Timestamp } from "#/runtime/model/index.ts"
import { Note } from "#/runtime/platform/model/note.ts"
import { noteSeed } from "#/runtime/platform/seeds/note.ts"
import { Database } from "#/runtime/server/index.ts"
import { linkSeedRecords } from "#/runtime/server/seeds.ts"

export const seedSalesDemo = Effect.fn("@company/seedSalesDemo")(function* ({
  accounts,
  contacts,
  owner,
}: CrmDemoData) {
  const now = yield* DateTime.now
  const records = yield* Database
  const services = {
    activity: records.repository(Activity),
    opportunity: records.repository(Opportunity),
    lead: records.repository(Lead),
    note: records.repository(Note),
  }
  const opportunity = yield* services.opportunity.create({
    name: "Northstar — service operations rollout",
    stage: "proposal",
    amount: { currency: CurrencyCode("USD"), amount: Decimal("48000") },
    nextStep:
      "Review the pilot results with Maya and agree on the rollout schedule.",
    links: { owner, contacts: [contacts[0].id] },
  })
  yield* linkSeedRecords(
    Opportunity,
    "accounts",
    opportunity.id,
    accounts[0].id
  )
  for (const [index, stage] of (
    ["discovery", "negotiation", "won", "lost"] as const
  ).entries()) {
    const other = yield* services.opportunity.create({
      name: `${accounts[index % 3]!.name} — expansion ${index + 1}`,
      stage,
      amount: {
        currency: CurrencyCode(index === 1 ? "EUR" : "USD"),
        amount: Decimal(String(12000 + index * 8000)),
      },
      links: { owner, contacts: [contacts[index % contacts.length]!.id] },
    })
    yield* linkSeedRecords(
      Opportunity,
      "accounts",
      other.id,
      accounts[index % 3]!.id
    )
  }
  for (const [index, name] of (
    [
      "Operations pilot",
      "Regional expansion",
      "Implementation review",
      "Service renewal",
      "Security review",
      "Partner rollout",
      "Enterprise evaluation",
      "Team training",
    ] as const
  ).entries())
    yield* services.lead.create({
      name: `${accounts[index % 3]!.name} — ${name}`,
      source: (["inbound", "referral", "outbound"] as const)[index % 3]!,
      status: (["new", "working", "qualified", "disqualified"] as const)[
        index % 4
      ]!,
      links: {
        owner,
        account: accounts[index % 3]!.id,
        contact: contacts[index % contacts.length]!.id,
      },
    })
  for (let index = 0; index < 8; index++) {
    const note = yield* services.note.create(
      noteSeed(index, contacts[index % contacts.length]!.name)
    )
    yield* linkSeedRecords(Note, "subjects", note.id, accounts[0].id)
    yield* linkSeedRecords(Note, "subjects", note.id, opportunity.id)
  }
  for (const [index, title] of (
    [
      "Pilot kickoff",
      "Review escalation workflow",
      "Confirm rollout decision",
    ] as const
  ).entries())
    yield* services.activity.create({
      title,
      kind: index === 1 ? "task" : "meeting",
      status: index === 0 ? "done" : "planned",
      dueAt: Timestamp(
        DateTime.formatIso(DateTime.add(now, { days: index - 1 }))
      ),
      links: {
        accounts: [accounts[0].id],
        contacts: [contacts[0].id],
        opportunities: [opportunity.id],
        owner: owner,
      },
    })
  return { opportunity: opportunity.id }
})
