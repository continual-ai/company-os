import { Effect } from "effect"

import type { DemoCustomer } from "@/modules/sales/server/demo-seed"
import { ModelImplementation } from "@/server/model/model-implementation"

export const seedMarketingDemo = Effect.fn("@company/seedMarketingDemo")(
  function* ({ owner, contacts }: DemoCustomer) {
    const { services } = yield* ModelImplementation
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
