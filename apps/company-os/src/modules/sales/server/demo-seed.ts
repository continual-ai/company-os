import { noteSeed } from "@company/notes/seeds"
import {
  CurrencyCode,
  Decimal,
  DomainName,
  RecordId,
  EmailAddress,
  Timestamp,
} from "@company/runtime"
import { Effect } from "effect"

import { Model } from "#/app.model.ts"
import { UserService } from "#/modules/access/user/server/user-service.ts"
import { importSeedAsset } from "#/modules/assets/server/seed-asset.ts"
import { ModelImplementation } from "#/server/model/model-implementation.ts"
import { linkSeedRecords } from "#/server/seeds/link-seed-records.ts"
import { ROOT_ID } from "#/system-records.ts"

export const seedSalesDemo = Effect.fn("@company/seedSalesDemo")(function* () {
  const { services } = yield* ModelImplementation
  const logos = yield* Effect.forEach(
    ["northstar", "verdant", "aperture"],
    (name) =>
      importSeedAsset(
        new URL(`./demo-assets/${name}.png`, import.meta.url),
        RecordId("authorizationScope")(ROOT_ID),
        "image/png"
      )
  )
  const portraits = yield* Effect.forEach(
    ["maya", "leo", "amina", "sam"],
    (name) =>
      importSeedAsset(
        new URL(`./demo-assets/${name}.png`, import.meta.url),
        RecordId("authorizationScope")(ROOT_ID),
        "image/png"
      )
  )
  const owner = yield* (yield* UserService).provision({
    name: "Alex Rivera",
    email: EmailAddress("alex@demo.example.test"),
    image: portraits[3]!,
  })
  const companies = yield* Effect.forEach(
    [
      [
        "Northstar Robotics",
        "northstar.example.test",
        "Manufacturing",
        "customer",
      ],
      ["Verdant Health", "verdant.example.test", "Healthcare", "prospect"],
      [
        "Aperture Design & Research Collective",
        "aperture.example.test",
        "Professional services",
        "prospect",
      ],
      ["Quiet Harbor", "harbor.example.test", "Other", "inactive"],
    ] as const,
    ([name, domain, industry, lifecycleStage], index) =>
      services.company.create({
        name,
        domain: DomainName(domain),
        industry,
        lifecycleStage,
        logo: logos[index] ?? null,
      })
  )
  const contacts = yield* Effect.forEach(
    [
      ["Maya Chen", "VP of Operations", "marketing", "optedIn"],
      ["Leo Martín", "Engineering Lead", "marketing", "optedOut"],
      [
        "Amina Okafor",
        "Independent advisor for operations and customer experience",
        "nonMarketing",
        "unknown",
      ],
      ["Sam Patel", "Procurement", "marketing", "unknown"],
      ["Noor Al-Hassan", "", "nonMarketing", "unknown"],
    ] as const,
    ([name, jobTitle, marketingStatus, emailPermission], index) =>
      services.contact.create({
        name,
        jobTitle: jobTitle || null,
        marketingStatus,
        emailPermission,
        email:
          index === 4
            ? null
            : EmailAddress(`contact-${index}@demo.example.test`),
        photo: portraits[index] ?? null,
      })
  )
  for (const [index, contact] of contacts.entries())
    yield* linkSeedRecords(
      Model.objects.contact,
      "primaryCompany",
      contact.id,
      companies[index % 3]!.id
    )
  yield* linkSeedRecords(
    Model.objects.company,
    "contacts",
    companies[0].id,
    contacts[2]!.id
  )
  const deal = yield* services.deal.create({
    parent: ROOT_ID,
    name: "Northstar — service operations rollout",
    stage: "proposal",
    owner: owner.id,
    amount: { currency: CurrencyCode("USD"), amount: Decimal("48000") },
    nextStep:
      "Review the pilot results with Maya and agree on the rollout schedule.",
  })
  yield* linkSeedRecords(
    Model.objects.deal,
    "companies",
    deal.id,
    companies[0].id
  )
  for (const [index, stage] of (
    ["discovery", "negotiation", "won", "lost"] as const
  ).entries()) {
    const other = yield* services.deal.create({
      parent: ROOT_ID,
      name: `${companies[index % 3]!.name} — expansion ${index + 1}`,
      stage,
      amount: {
        currency: CurrencyCode(index === 1 ? "EUR" : "USD"),
        amount: Decimal(String(12000 + index * 8000)),
      },
      owner: owner.id,
    })
    yield* linkSeedRecords(
      Model.objects.deal,
      "companies",
      other.id,
      companies[index % 3]!.id
    )
  }
  for (const [index, name] of (
    [
      "Elena García",
      "Oliver Brooks",
      "Yuki Tanaka",
      "Priya Shah",
      "Robin Lee",
      "Daniel Kim",
      "Sofia Rossi",
      "Jules Bernard",
    ] as const
  ).entries())
    yield* services.lead.create({
      name,
      company: index % 2 === 0 ? companies[index % 3]!.id : null,
      companyName: index % 2 === 0 ? null : "Westbridge Labs",
      email: EmailAddress(`lead-${index}@demo.example.test`),
      source: (["inbound", "referral", "outbound"] as const)[index % 3]!,
      status: (["new", "working", "qualified", "disqualified"] as const)[
        index % 4
      ]!,
    })
  for (let index = 0; index < 8; index++) {
    const note = yield* services.note.create(
      noteSeed(index, contacts[index % contacts.length]!.name)
    )
    yield* linkSeedRecords(
      Model.objects.note,
      "subjects",
      note.id,
      companies[0].id
    )
    yield* linkSeedRecords(Model.objects.note, "subjects", note.id, deal.id)
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
      company: companies[0].id,
      contact: contacts[0].id,
      deal: deal.id,
      owner: owner.id,
      kind: index === 1 ? "task" : "meeting",
      status: index === 0 ? "done" : "planned",
      dueAt: Timestamp(
        new Date(Date.now() + (index - 1) * 86400000).toISOString()
      ),
    })
  return {
    company: companies[0].id,
    contact: contacts[0].id,
    owner: owner.id,
    contacts: contacts.map(({ id }) => id),
  }
})

export interface DemoCustomer {
  readonly company: RecordId<"company">
  readonly contact: RecordId<"contact">
  readonly owner: RecordId<"user">
  readonly contacts: ReadonlyArray<RecordId<"contact">>
}
