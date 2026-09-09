import { Effect } from "effect"

import { Campaign } from "#/modules/marketing/model/campaign.ts"
import { Enrollment } from "#/modules/marketing/model/enrollment.ts"
import { Outreach } from "#/modules/marketing/model/outreach.ts"
import type { RecordId } from "#/runtime/model/index.ts"
import { Records } from "#/runtime/server/index.ts"

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
