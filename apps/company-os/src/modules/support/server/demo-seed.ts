import type { RecordId } from "@company/runtime"
import { Effect } from "effect"

import { Model } from "#/app.model.ts"
import type { DemoCustomer } from "#/modules/sales/server/demo-seed.ts"
import { ModelImplementation } from "#/server/model/model-implementation.ts"
import { linkSeedRecords } from "#/server/seeds/link-seed-records.ts"

export const seedSupportDemo = Effect.fn("@company/seedSupportDemo")(function* (
  customer: DemoCustomer,
  issue: RecordId<"issue">
) {
  const { services } = yield* ModelImplementation
  const ticket = yield* services.ticket.create({
    subject: "New teammates cannot accept expired invitations",
    company: customer.company,
    requester: customer.contact,
    owner: customer.owner,
    status: "waitingOnTeam",
    priority: "high",
    description:
      "Maya invited the operations team last week. Several links expired before the team could finish setup.",
  })
  yield* linkSeedRecords(Model.objects.ticket, "issues", ticket.id, issue)
  yield* services.reply.create({
    ticket: ticket.id,
    subject: "Invitation recovery",
    direction: "inbound",
    status: "received",
    body: "Could you help us get the remaining teammates into the pilot? Their invitation links expired.",
  })
  yield* services.reply.create({
    ticket: ticket.id,
    subject: "Engineering follow-up",
    direction: "internal",
    body: "Linked the recovery issue. Follow up after the fix is verified.",
  })
  yield* services.ticket.create({
    subject: "Confirm export format",
    company: customer.company,
    requester: customer.contact,
    owner: customer.owner,
    status: "resolved",
    resolution: "Shared a sample CSV and confirmed the column mapping.",
  })
})
