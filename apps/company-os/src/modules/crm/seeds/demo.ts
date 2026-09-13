import { Effect } from "effect"

import { Account, Contact, Affiliation } from "#/modules/crm/model/index.ts"
import { UserService } from "#/runtime/access/server/user-service.ts"
import { importSeedAsset } from "#/runtime/assets/server/seed-asset.ts"
import { DomainName, EmailAddress } from "#/runtime/model/index.ts"
import { Database } from "#/runtime/server/index.ts"
export const seedCrmDemo = Effect.fn("@company/seedCrmDemo")(function* () {
  const records = yield* Database
  const services = {
    account: records.repository(Account),
    contact: records.repository(Contact),
  }
  const logos = yield* Effect.forEach(
    ["northstar", "verdant", "aperture"],
    (name) =>
      importSeedAsset(
        new URL(`./assets/${name}.png`, import.meta.url),
        "image/png"
      )
  )
  const portraits = yield* Effect.forEach(
    ["maya", "leo", "amina", "sam"],
    (name) =>
      importSeedAsset(
        new URL(`./assets/${name}.png`, import.meta.url),
        "image/png"
      )
  )
  const owner = yield* (yield* UserService).provision({
    name: "Alex Rivera",
    email: EmailAddress("alex@demo.example.test"),
    image: portraits[3]!,
  })
  const accounts = yield* Effect.forEach(
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
      services.account.create({
        name,
        links: { owner: owner.id },
        domain: DomainName(domain),
        industry,
        lifecycleStage,
        logo: logos[index] ?? null,
      })
  )
  const people = [
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
  ] as const
  const contacts = yield* Effect.forEach(
    people,
    ([name, , marketingStatus, emailPermission], index) =>
      services.contact.create({
        name,
        marketingStatus,
        emailPermission,
        email:
          index === 4
            ? null
            : EmailAddress(`contact-${index}@demo.example.test`),
        photo: portraits[index] ?? null,
      })
  )
  for (const [index, contact] of contacts.entries()) {
    yield* records.repository(Affiliation).create({
      jobTitle: people[index]![1] || null,
      links: { contact: contact.id, account: accounts[index % 3]!.id },
    })
  }
  yield* records.repository(Affiliation).create({
    jobTitle: "Advisor",
    links: { contact: contacts[2]!.id, account: accounts[0].id },
  })
  return { accounts, contacts, owner: owner.id }
})
export type CrmDemoData = Effect.Success<ReturnType<typeof seedCrmDemo>>
