import { Effect } from "effect"

import { Account } from "#/modules/crm/model/account.ts"
import { Affiliation } from "#/modules/crm/model/affiliation.ts"
import { Contact } from "#/modules/crm/model/contact.ts"
import { importSeedAsset } from "#/runtime/assets/server/seed-asset.ts"
import {
  type RecordId,
  DomainName,
  EmailAddress,
  PhoneNumber,
} from "#/runtime/model/index.ts"
import { Note } from "#/runtime/platform/model/note.ts"
import { noteSeed } from "#/runtime/platform/seeds/note.ts"
import { Database } from "#/runtime/server/index.ts"
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
const accountNames = [
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

export type CrmSeedData = Effect.Success<ReturnType<typeof seedCrmPerformance>>

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

export const seedCrmPerformance = Effect.fn("@company/seedCrmPerformance")(
  function* (size: number, owners: ReadonlyArray<RecordId<"user">>) {
    const records = yield* Database
    const logos = yield* Effect.forEach(
      ["northstar", "verdant", "aperture"],
      (name) =>
        importSeedAsset(
          new URL(`./assets/${name}.png`, import.meta.url),
          "image/png"
        )
    )
    const photos = yield* Effect.forEach(
      ["maya", "leo", "amina", "sam"],
      (name) =>
        importSeedAsset(
          new URL(`./assets/${name}.png`, import.meta.url),
          "image/png"
        )
    )
    const accounts = yield* Effect.forEach(
      Array.from({ length: Math.max(2, Math.ceil(size / 10)) }),
      (_, index) => {
        const industry =
          industries[
            Math.floor(index / accountNames.length) % industries.length
          ]!
        const region = Math.floor(
          index / (accountNames.length * industries.length)
        )
        return records.repository(Account).create({
          name: `${accountNames[index % accountNames.length]} ${industry.suffix}${region > 0 ? ` — ${["Americas", "Europe", "Asia Pacific", "Middle East", "Africa", "Canada", "Australia"][region - 1]}` : ""}`,
          links: { owner: owners[index % owners.length]! },
          domain: DomainName(
            `${accountNames[index % accountNames.length]!.toLowerCase().replaceAll(" ", "-")}-${industry.suffix.toLowerCase()}${region > 0 ? `-${region}` : ""}.example.test`
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
      // A large account deliberately exercises long link lists as well as ordinary small accounts.
      const account =
        accounts[index < Math.ceil(size / 3) ? 0 : index % accounts.length]!
      const owner = owners[index % owners.length]!
      const contact = yield* records.repository(Contact).create({
        name: personName(index),
        email:
          index % 11 === 0
            ? null
            : EmailAddress(`${emailName(index)}@${account.domain}`),
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
        account: account.id,
        accountName: account.name,
        contact: contact.id,
        name: contact.name,
        owner,
        eligible:
          contact.marketingStatus === "marketing" &&
          contact.emailPermission === "optedIn" &&
          contact.email !== null,
        optedOut: contact.emailPermission === "optedOut",
      })
      yield* records.repository(Affiliation).create({
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
        links: { contact: contact.id, account: account.id },
      })
      if (index % 10 === 0 && account.id !== accounts[1]!.id)
        yield* records.repository(Affiliation).create({
          jobTitle: "Advisor",
          links: { contact: contact.id, account: accounts[1]!.id },
        })
      const note = yield* records
        .repository(Note)
        .create(noteSeed(index, contact.name))
      yield* linkSeedRecords(Note, "subjects", note.id, account.id)
      yield* linkSeedRecords(Note, "subjects", note.id, contact.id)
    }
    return { customers, owners }
  }
)
