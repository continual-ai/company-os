import { DomainName, RecordId, EmailAddress } from "@company/runtime"
import { Model } from "company-os/model"
import { Effect } from "effect"

import { importSeedAsset } from "@/modules/assets/server/seed-asset"
import { ModelImplementation } from "@/server/model/model-implementation"
import { linkSeedRecords } from "@/server/seeds/link-seed-records"
import { ROOT_ID } from "@/system-records"

export const seedSalesPerformance = Effect.fn("@company/seedSalesPerformance")(
  function* (size: number) {
    const { services } = yield* ModelImplementation
    const logo = yield* importSeedAsset(
      new URL("./demo-assets/northstar.png", import.meta.url),
      RecordId("authorizationScope")(ROOT_ID),
      "image/png"
    )
    const photo = yield* importSeedAsset(
      new URL("./demo-assets/amina.png", import.meta.url),
      RecordId("authorizationScope")(ROOT_ID),
      "image/png"
    )
    const companies = yield* Effect.forEach(
      Array.from({ length: Math.max(2, Math.ceil(size / 10)) }),
      (_, index) =>
        services.company.create({
          name:
            index === 0
              ? "Scale — Atlas Operations"
              : `Scale — ${(["North", "Silver", "West", "Green"] as const)[index % 4]} ${["Industries", "Labs", "Health", "Partners"][Math.floor(index / 4) % 4]} ${String(index).padStart(4, "0")}`,
          domain: DomainName(`company-${index}.scale.example.test`),
          logo: index % 3 === 0 ? logo : null,
          lifecycleStage: (["customer", "prospect", "inactive"] as const)[
            index % 3
          ]!,
          industry: index % 2 === 0 ? "Manufacturing" : "Healthcare",
        })
    )
    const names = [
      "Maya Chen",
      "Leo Martín",
      "Amina Okafor",
      "Sam Patel",
      "Elena García",
      "Yuki Tanaka",
      "Sofia Rossi",
      "Noor Al-Hassan",
    ]
    const contacts = []
    for (let index = 0; index < size; index++) {
      const serial = String(index + 1).padStart(5, "0")
      const company =
        companies[index < Math.ceil(size / 2) ? 0 : index % companies.length]!
      const contact = yield* services.contact.create({
        name: `${names[index % names.length]} ${serial}`,
        jobTitle:
          index % 7 === 0
            ? "Director of international customer experience and operational excellence"
            : index % 5 === 0
              ? null
              : "Operations manager",
        email:
          index % 11 === 0
            ? null
            : EmailAddress(`person-${serial}@scale.example.test`),
        photo: index % 3 === 0 ? photo : null,
        marketingStatus: index % 4 === 0 ? "nonMarketing" : "marketing",
        emailPermission: (["optedIn", "unknown", "optedOut"] as const)[
          index % 3
        ]!,
      })
      contacts.push(contact.id)
      yield* linkSeedRecords(
        Model.objects.contact,
        "primaryCompany",
        contact.id,
        company.id
      )
      if (index % 10 === 0)
        yield* linkSeedRecords(
          Model.objects.company,
          "contacts",
          companies[1]!.id,
          contact.id
        )
      yield* services.lead.create({
        name: `Scale prospect ${serial}`,
        company: company.id,
        email:
          index % 6 === 0
            ? null
            : EmailAddress(`prospect-${serial}@scale.example.test`),
        status: (["new", "working", "qualified", "disqualified"] as const)[
          index % 4
        ]!,
        source: (["inbound", "referral", "outbound"] as const)[index % 3]!,
      })
      const note = yield* services.note.create({
        content: `### Review ${serial}\n\nDiscussed the onboarding plan with **${contact.name}**.\n\n${index % 5 === 0 ? "- [x] Confirm data mapping\n- [ ] Review exceptions\n\n" : ""}${"Keep customer context available when moving between records. ".repeat(index % 9 === 0 ? 30 : 2)}`,
      })
      yield* linkSeedRecords(
        Model.objects.note,
        "subjects",
        note.id,
        company.id
      )
      if ((index + 1) % 100 === 0)
        yield* Effect.log(
          `Prepared ${index + 1}/${size} contacts, leads, and notes.`
        )
    }
    return { companies: companies.map(({ id }) => id), contacts }
  }
)
