import { DateTime, Effect } from "effect"

import type { CrmSeedData } from "#/modules/crm/seeds/index.ts"
import { Reply } from "#/modules/service/model/reply.ts"
import { Ticket } from "#/modules/service/model/ticket.ts"
import { Timestamp } from "#/runtime/model/index.ts"
import { Database } from "#/runtime/server/index.ts"

const subjects = [
  "Invitation link expired before setup",
  "CSV import stopped at the final step",
  "Need access to the regional dashboard",
  "Approval is waiting on a former teammate",
  "Export does not include the latest records",
  "Clarify the upcoming renewal",
  "Help us configure customer notifications",
  "Image upload appears rotated",
  "Cannot find a recently merged account",
  "Confirm our implementation timeline",
]

export const seedServicePerformance = Effect.fn(
  "@company/seedServicePerformance"
)(function* ({ customers }: CrmSeedData) {
  const now = yield* DateTime.now
  const records = yield* Database
  const escalatable = []
  for (let index = 0; index < Math.ceil(customers.length / 2); index++) {
    const customer = customers[index]!
    const status = (
      [
        "new",
        "open",
        "waitingOnCustomer",
        "waitingOnTeam",
        "resolved",
        "closed",
      ] as const
    )[index % 6]!
    const closed = status === "resolved" || status === "closed"
    const ticket = yield* records.repository(Ticket).create({
      subject: `${subjects[index % subjects.length]} — ${customer.accountName}`,
      status,
      priority: (["normal", "normal", "low", "high", "urgent"] as const)[
        Math.floor(index / 2) % 5
      ]!,
      description: `${customer.name} reported a problem during the ${customer.accountName} rollout. The team can continue other work, but needs help before the next milestone.\n\nSteps taken:\n1. Checked the account and current permissions.\n2. Repeated the action in a new session.\n3. Captured the affected record for follow-up.`,
      respondByAt: closed
        ? null
        : Timestamp(
            DateTime.formatIso(DateTime.add(now, { hours: (index % 72) - 24 }))
          ),
      resolution: closed
        ? "Verified the fix with the requester and shared the updated instructions with their team."
        : null,
      externalId: `HELP-${4200 + index}`,
      links: {
        account: customer.account,
        requester: customer.contact,
        owner: index % 9 === 0 ? null : customer.owner,
      },
    })
    if (status === "waitingOnTeam") escalatable.push(ticket.id)
    for (const [replyIndex, message] of (
      [
        {
          direction: "inbound",
          status: "received",
          body: `Hi team, we are running into this during onboarding at ${customer.accountName}. Could you help us get unblocked before our next rollout meeting?\n\nThanks,\n${customer.name}`,
        },
        {
          direction: "internal",
          status: "draft",
          body: "Checked the account history and reproduced the reported behavior. Keep the customer informed while we verify the next step.",
        },
        {
          direction: "outbound",
          status: closed ? "sent" : "draft",
          body: closed
            ? `Hi ${customer.name},\n\nWe have verified the fix and confirmed that your team can continue. Please reply if anything else comes up.`
            : `Hi ${customer.name},\n\nThanks for the details. We are reviewing the affected account and will follow up with a clear next step.`,
        },
      ] as const
    ).entries()) {
      yield* records.repository(Reply).create({
        subject: `Re: ${ticket.subject}`,
        direction: message.direction,
        status: message.status,
        body: message.body,
        sentAt:
          message.status === "sent" || message.status === "received"
            ? Timestamp(
                DateTime.formatIso(
                  DateTime.subtract(now, {
                    hours: (index % 48) + 3 - replyIndex,
                  })
                )
              )
            : null,
        links: { ticket: ticket.id },
      })
    }
  }
  yield* Effect.log("Prepared support queues and customer conversations.")
  return escalatable
})
