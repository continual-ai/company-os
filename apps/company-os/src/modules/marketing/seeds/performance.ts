import { DateTime, Effect } from "effect"

import type { CrmSeedData } from "#/modules/crm/seeds/index.ts"
import { CampaignMember } from "#/modules/marketing/model/campaign-member.ts"
import { Campaign } from "#/modules/marketing/model/campaign.ts"
import { Content } from "#/modules/marketing/model/content.ts"
import { Outreach } from "#/modules/marketing/model/outreach.ts"
import {
  CalendarDate,
  CurrencyCode,
  Decimal,
  Timestamp,
  WebUrl,
} from "#/runtime/model/index.ts"
import { Database } from "#/runtime/server/index.ts"

const topics = [
  "Operations roundtable",
  "Customer onboarding workshop",
  "Quarterly product briefing",
  "Partner launch program",
  "Customer stories",
  "Practical automation guide",
  "Regional leadership breakfast",
  "Implementation office hours",
]

export const seedMarketingPerformance = Effect.fn(
  "@company/seedMarketingPerformance"
)(function* ({ customers, owners }: CrmSeedData) {
  const now = yield* DateTime.now
  const records = yield* Database
  const campaigns = []
  for (
    let index = 0;
    index < Math.max(5, Math.ceil(customers.length / 25));
    index++
  ) {
    const start = DateTime.add(now, { days: (index % 90) - 60 })
    campaigns.push(
      yield* records.repository(Campaign).create({
        name: `${topics[index % topics.length]} — ${["North America", "Europe", "Asia Pacific", "Global", "Partner community"][Math.floor(index / topics.length) % 5]}`,
        objective:
          "Help operations teams share practical lessons and evaluate the next step in their rollout.",
        channel: (["content", "paid", "outbound", "nurture", "event"] as const)[
          index % 5
        ]!,
        status: (
          ["draft", "planned", "active", "paused", "completed"] as const
        )[Math.floor(index / 2) % 5]!,
        budget:
          index % 7 === 0
            ? null
            : {
                currency: CurrencyCode("USD"),
                amount: Decimal(String(2500 + (index % 12) * 1500)),
              },
        startDate: CalendarDate(DateTime.formatIso(start).slice(0, 10)),
        endDate: CalendarDate(
          DateTime.formatIso(DateTime.add(start, { days: 30 })).slice(0, 10)
        ),
        links: { owner: owners[index % owners.length]! },
      })
    )
  }
  let eligibleIndex = 0
  for (const [index, customer] of customers.entries()) {
    const campaign = campaigns[index % campaigns.length]!
    if (index % 4 === 0) {
      const contentIndex = index / 4
      const contentStatus = (
        [
          "draft",
          "review",
          "approved",
          "scheduled",
          "published",
          "archived",
        ] as const
      )[contentIndex % 6]!
      yield* records.repository(Content).create({
        title: `${topics[contentIndex % topics.length]}: lessons from ${customer.accountName}`,
        format: (["article", "social", "email", "ad", "landingPage"] as const)[
          contentIndex % 5
        ]!,
        status: contentStatus,
        brief:
          "Share a practical example of reducing manual follow-up. Include the original problem, the workflow change, and what the team learned.",
        body: `# A clearer customer handoff\n\nThe team at **${customer.accountName}** needed a reliable way to keep customers informed.\n\n## What changed\n\n- Each request has one accountable owner.\n- Customers can see progress and provide missing details.\n- Exceptions reach the right team with their original context.\n\n${"Start with one operation, review the results with the team, and adapt the next step.\n\n".repeat(contentIndex % 9 === 0 ? 30 : 3)}`,
        scheduledAt:
          contentStatus === "scheduled"
            ? Timestamp(
                DateTime.formatIso(
                  DateTime.add(now, { days: (contentIndex % 14) + 1 })
                )
              )
            : null,
        publishedUrl:
          contentStatus === "published"
            ? WebUrl(
                `https://stories.example.test/customer-handoff-${contentIndex}`
              )
            : null,
        links: { campaign: campaign.id, owner: customer.owner },
      })
    }
    const sequence = customer.eligible ? eligibleIndex++ : 0
    const status = customer.eligible
      ? (["queued", "active", "paused", "completed"] as const)[sequence % 4]!
      : customer.optedOut
        ? "unsubscribed"
        : "paused"
    const outreachStatus = customer.eligible
      ? (["draft", "review", "queued", "sent", "replied", "failed"] as const)[
          sequence % 6
        ]!
      : "canceled"
    const sent = outreachStatus === "sent" || outreachStatus === "replied"
    yield* records.repository(CampaignMember).create({
      status,
      step: status === "completed" ? 3 : index % 3,
      nextTouchAt:
        status === "active" || status === "queued"
          ? Timestamp(
              DateTime.formatIso(DateTime.add(now, { days: (index % 14) - 3 }))
            )
          : null,
      context: customer.eligible
        ? `Interested in practical examples for ${customer.accountName}. Follow up with the session recording and implementation checklist.`
        : "No eligible email permission; no further outreach is scheduled.",
      links: { campaign: campaign.id, contact: customer.contact },
    })
    yield* records.repository(Outreach).create({
      subject: `${campaign.name}: next steps for ${customer.accountName}`,
      status: outreachStatus,
      body: `Hi ${customer.name},\n\nWe are bringing together operations teams to share what worked during their first rollout. Would a practical session on customer onboarding be useful for ${customer.accountName}?\n\nWe can walk through approval steps, customer communication, and the handoff to engineering.\n\nBest,\nThe customer team`,
      scheduledAt:
        outreachStatus === "queued"
          ? Timestamp(
              DateTime.formatIso(
                DateTime.add(now, { days: index % 7, hours: 2 })
              )
            )
          : null,
      sentAt: sent
        ? Timestamp(
            DateTime.formatIso(
              DateTime.subtract(now, { days: (index % 21) + 1 })
            )
          )
        : null,
      failure:
        outreachStatus === "failed"
          ? "The recipient mail server temporarily rejected delivery. Review before retrying."
          : null,
      links: {
        campaign: campaign.id,
        contact: customer.contact,
        owner: customer.owner,
      },
    })
  }
  yield* Effect.log(
    "Prepared campaigns, campaignMembers, and outreach history."
  )
})
