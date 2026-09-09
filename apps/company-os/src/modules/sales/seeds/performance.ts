import { DateTime, Effect } from "effect"

import { Note } from "#/modules/notes/model/index.ts"
import { noteSeed } from "#/modules/notes/seeds/index.ts"
import { Activity } from "#/modules/sales/model/activity.ts"
import { Company } from "#/modules/sales/model/company.ts"
import { Contact } from "#/modules/sales/model/contact.ts"
import { Deal } from "#/modules/sales/model/deal.ts"
import { Lead } from "#/modules/sales/model/lead.ts"
import { LineItem } from "#/modules/sales/model/line-item.ts"
import { importSeedAsset } from "#/runtime/assets/server/seed-asset.ts"
import {
  CalendarDate,
  CurrencyCode,
  Decimal,
  DomainName,
  RecordId,
  EmailAddress,
  PhoneNumber,
  Timestamp,
} from "#/runtime/model/index.ts"
import { ROOT_ID } from "#/runtime/model/system-records.ts"
import { Records } from "#/runtime/server/index.ts"
import { linkSeedRecords } from "#/runtime/server/seeds.ts"

const firstNames = [
  "Maya",
  "Leo",
  "Amina",
  "Sam",
  "Elena",
  "Yuki",
  "Sofia",
  "Noor",
  "Oliver",
  "Priya",
  "Robin",
  "Daniel",
  "Jules",
  "Isabel",
  "Marcus",
  "Hana",
  "Owen",
  "Felix",
  "Camille",
  "Nadia",
  "Lucas",
  "Grace",
  "Amara",
  "Theo",
]
const lastNames = [
  "Chen",
  "Martín",
  "Okafor",
  "Patel",
  "García",
  "Tanaka",
  "Rossi",
  "Al-Hassan",
  "Brooks",
  "Shah",
  "Lee",
  "Kim",
  "Bernard",
  "Torres",
  "Reed",
  "Suzuki",
  "Price",
  "Weber",
  "Laurent",
  "Silva",
  "Wang",
  "Diallo",
  "Morgan",
  "Wilson",
]
const companyNames = [
  "Atlas",
  "Silver Fern",
  "Westbridge",
  "Juniper",
  "Cedar Grove",
  "Meridian",
  "Copperleaf",
  "Stonehaven",
  "Clearwater",
  "Bluebird",
  "Redwood",
  "Summit",
  "Fieldstone",
  "Beacon",
  "Linden",
  "Willow",
]
const industries = [
  { suffix: "Robotics", name: "Manufacturing" },
  { suffix: "Health", name: "Healthcare" },
  { suffix: "Logistics", name: "Other" },
  { suffix: "Design", name: "Professional services" },
  { suffix: "Energy", name: "Other" },
  { suffix: "Analytics", name: "SaaS/Technology" },
  { suffix: "Foods", name: "Retail" },
  { suffix: "Construction", name: "Other" },
] as const
const initiatives = [
  "Customer onboarding",
  "Regional rollout",
  "Service renewal",
  "Operations pilot",
  "Partner enablement",
  "Enterprise expansion",
]

export type SalesSeedData = Effect.Success<
  ReturnType<typeof seedSalesPerformance>
>

function personName(index: number) {
  return `${firstNames[index % firstNames.length]} ${lastNames[(index * 7 + Math.floor(index / firstNames.length)) % lastNames.length]}`
}

function emailName(index: number) {
  const nameCount = firstNames.length * lastNames.length
  return (
    personName(index)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replaceAll(" ", ".") +
    (index >= nameCount ? String(Math.floor(index / nameCount) + 1) : "")
  )
}

export const seedSalesPerformance = Effect.fn("@company/seedSalesPerformance")(
  function* (size: number, owners: ReadonlyArray<RecordId<"user">>) {
    const now = yield* DateTime.now
    const date = (days: number) =>
      CalendarDate(DateTime.formatIso(DateTime.add(now, { days })).slice(0, 10))
    const records = yield* Records
    const logos = yield* Effect.forEach(
      ["northstar", "verdant", "aperture"],
      (name) =>
        importSeedAsset(
          new URL(`./assets/${name}.png`, import.meta.url),
          RecordId("authorizationScope")(ROOT_ID),
          "image/png"
        )
    )
    const photos = yield* Effect.forEach(
      ["maya", "leo", "amina", "sam"],
      (name) =>
        importSeedAsset(
          new URL(`./assets/${name}.png`, import.meta.url),
          RecordId("authorizationScope")(ROOT_ID),
          "image/png"
        )
    )
    const companies = yield* Effect.forEach(
      Array.from({ length: Math.max(2, Math.ceil(size / 10)) }),
      (_, index) => {
        const industry =
          industries[
            Math.floor(index / companyNames.length) % industries.length
          ]!
        const region = Math.floor(
          index / (companyNames.length * industries.length)
        )
        return records.writer(Company).create({
          name: `${companyNames[index % companyNames.length]} ${industry.suffix}${region > 0 ? ` — ${["Americas", "Europe", "Asia Pacific", "Middle East", "Africa", "Canada", "Australia"][region - 1]}` : ""}`,
          domain: DomainName(
            `${companyNames[index % companyNames.length]!.toLowerCase().replaceAll(" ", "-")}-${industry.suffix.toLowerCase()}${region > 0 ? `-${region}` : ""}.example.test`
          ),
          logo: index % 4 === 0 ? null : logos[index % logos.length]!,
          lifecycleStage: (
            [
              "customer",
              "prospect",
              "customer",
              "prospect",
              "inactive",
            ] as const
          )[index % 5]!,
          industry: industry.name,
        })
      }
    )
    const customers = []
    for (let index = 0; index < size; index++) {
      // A large account deliberately exercises long relationship lists as well as ordinary small accounts.
      const company =
        companies[index < Math.ceil(size / 3) ? 0 : index % companies.length]!
      const owner = owners[index % owners.length]!
      const contact = yield* records.writer(Contact).create({
        name: personName(index),
        jobTitle:
          index % 17 === 0
            ? "Director of international customer experience and operational excellence"
            : index % 7 === 0
              ? null
              : [
                  "Operations manager",
                  "VP of Engineering",
                  "Customer success lead",
                  "Procurement director",
                  "Founder",
                  "Finance manager",
                ][index % 6]!,
        email:
          index % 11 === 0
            ? null
            : EmailAddress(`${emailName(index)}@${company.domain}`),
        phone:
          index % 4 === 0
            ? null
            : PhoneNumber(
                `+1${["415", "212", "312", "206"][index % 4]}55501${String(index % 100).padStart(2, "0")}`
              ),
        photo: index % 3 === 0 ? photos[index % photos.length]! : null,
        marketingStatus: index % 4 === 0 ? "nonMarketing" : "marketing",
        emailPermission: (["optedIn", "unknown", "optedOut"] as const)[
          index % 3
        ]!,
      })
      customers.push({
        company: company.id,
        companyName: company.name,
        contact: contact.id,
        name: contact.name,
        owner,
        eligible:
          contact.marketingStatus === "marketing" &&
          contact.emailPermission === "optedIn" &&
          contact.email !== null,
        optedOut: contact.emailPermission === "optedOut",
      })
      yield* linkSeedRecords(Contact, "primaryCompany", contact.id, company.id)
      if (index % 10 === 0 && company.id !== companies[1]!.id)
        yield* linkSeedRecords(
          Company,
          "contacts",
          companies[1]!.id,
          contact.id
        )
      yield* records.writer(Lead).create({
        name: personName(index + 137),
        company: index % 5 === 0 ? null : company.id,
        companyName: index % 5 === 0 ? company.name : null,
        email:
          index % 6 === 0
            ? null
            : EmailAddress(`${emailName(index + 137)}@${company.domain}`),
        phone:
          index % 3 === 0
            ? null
            : PhoneNumber(
                `+1${["617", "512", "303"][index % 3]}55501${String(index % 100).padStart(2, "0")}`
              ),
        status: (["new", "working", "qualified", "disqualified"] as const)[
          index % 4
        ]!,
        source: (["inbound", "referral", "outbound"] as const)[index % 3]!,
      })
      const note = yield* records
        .writer(Note)
        .create(noteSeed(index, contact.name))
      yield* linkSeedRecords(Note, "subjects", note.id, company.id)
      yield* linkSeedRecords(Note, "subjects", note.id, contact.id)
      let dealId: RecordId<"deal"> | null = null
      if (index % 2 === 0) {
        const dealIndex = index / 2
        const currency = CurrencyCode(
          (["USD", "EUR", "GBP"] as const)[dealIndex % 3]!
        )
        const monthlyPrice = 1250 + (dealIndex % 20) * 250
        const deal = yield* records.writer(Deal).create({
          parent: ROOT_ID,
          name: `${company.name} — ${initiatives[dealIndex % initiatives.length]}`,
          owner,
          stage: (
            [
              "discovery",
              "qualified",
              "proposal",
              "negotiation",
              "won",
              "lost",
            ] as const
          )[dealIndex % 6]!,
          amount:
            dealIndex % 11 === 0
              ? null
              : { currency, amount: Decimal(String(monthlyPrice * 12 + 7500)) },
          expectedCloseDate: date((dealIndex % 90) - 20),
          nextStep:
            dealIndex % 11 === 0
              ? null
              : [
                  "Review rollout scope with the operations team.",
                  "Confirm security requirements and procurement timeline.",
                  "Send the pilot results for sponsor approval.",
                ][dealIndex % 3]!,
          nextStepDate: date((dealIndex % 21) - 7),
        })
        dealId = deal.id
        yield* linkSeedRecords(Deal, "companies", deal.id, company.id)
        yield* linkSeedRecords(Note, "subjects", note.id, deal.id)
        for (const item of [
          {
            name: "Managed operations subscription",
            quantity: 12,
            price: monthlyPrice,
          },
          { name: "Implementation and onboarding", quantity: 1, price: 5000 },
          { name: "Team training workshop", quantity: 2, price: 1250 },
        ])
          yield* records.writer(LineItem).create({
            parent: deal.id,
            name: item.name,
            quantity: item.quantity,
            unitPrice: { currency, amount: Decimal(String(item.price)) },
          })
      }
      const status = (["planned", "planned", "done", "canceled"] as const)[
        index % 4
      ]!
      yield* records.writer(Activity).create({
        title: `${["Review pilot results", "Confirm implementation scope", "Discuss renewal", "Schedule security review", "Follow up on open questions"][index % 5]} — ${company.name}`,
        company: company.id,
        contact: contact.id,
        deal: dealId,
        owner,
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
      })
      if ((index + 1) % 100 === 0)
        yield* Effect.log(
          `Prepared ${index + 1}/${size} customer records and their sales history.`
        )
    }
    return { customers, owners }
  }
)
