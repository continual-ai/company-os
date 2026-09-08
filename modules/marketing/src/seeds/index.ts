import type { RecordId } from "@company/runtime/model"
import { Records } from "@company/runtime/server"
import { Effect } from "effect"

import { Campaign } from "#/model/campaign.ts"
import { Enrollment } from "#/model/enrollment.ts"
import { Outreach } from "#/model/outreach.ts"

export const seedMarketingDemo = Effect.fn("@company/seedMarketingDemo")(
  function* ({
    owner,
    contacts,
  }: {
    readonly owner: RecordId<"user">
    readonly contacts: ReadonlyArray<RecordId<"contact">>
  }) {
    const records = yield* Records
    const services = {
      campaign: records.writer(Campaign),
      enrollment: records.writer(Enrollment),
      outreach: records.writer(Outreach),
    }
    const campaign = yield* services.campaign.create({
      name: "Operations roundtable",
      channel: "event",
      status: "active",
      owner,
      objective:
        "Bring operations leaders together to share lessons from their pilots.",
    })
    for (const [index, contact] of contacts.entries()) {
      yield* services.enrollment.create({
        name: `Roundtable participant ${index + 1}`,
        campaign: campaign.id,
        contact,
        status:
          index === 1 ? "unsubscribed" : index === 0 ? "active" : "paused",
        step: index === 0 ? 1 : 0,
        context:
          index === 0
            ? "Opted in; ready for review."
            : "Do not send until audience eligibility is checked.",
      })
      yield* services.outreach.create({
        subject: "Invitation to the operations roundtable",
        campaign: campaign.id,
        contact,
        owner,
        status: index === 0 ? "review" : "canceled",
        body: "A small discussion about what makes customer operations work well.",
      })
    }
  }
)
