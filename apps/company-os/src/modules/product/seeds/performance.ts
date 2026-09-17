import { DateTime, Effect } from "effect"

import type { CrmSeedData } from "#/modules/crm/seeds/index.ts"
import { Issue } from "#/modules/product/model/issue.ts"
import { Project } from "#/modules/product/model/project.ts"
import { CalendarDate } from "#/runtime/model/index.ts"
import { Database } from "#/runtime/server/index.ts"

const workstreams = [
  "Customer onboarding",
  "Data import reliability",
  "Access management",
  "Reporting and exports",
  "Mobile experience",
  "Billing integration",
  "Search performance",
  "Partner portal",
]
const changes = [
  "Recover expired invitations",
  "Preserve filters after navigation",
  "Retry interrupted imports",
  "Improve keyboard navigation",
  "Explain missing permissions",
  "Paginate large customer exports",
  "Handle duplicate webhook deliveries",
  "Show upload progress",
  "Support international account names",
  "Keep approval history after reassignment",
]

export const seedProductPerformance = Effect.fn(
  "@company/seedProductPerformance"
)(function* ({ customers, owners }: CrmSeedData) {
  const now = yield* DateTime.now
  const records = yield* Database
  const projects = []
  const issues = []
  const accounts = [
    ...new Map(
      customers.map((customer) => [customer.account, customer.accountName])
    ).values(),
  ]
  for (
    let index = 0;
    index < Math.max(4, Math.ceil(customers.length / 20));
    index++
  ) {
    const project = yield* records.repository(Project).create({
      name: `${workstreams[index % workstreams.length]} — ${accounts[index % accounts.length]}`,
      objective:
        "Reduce manual follow-up and make the next step clear for customers and the operations team.",
      status: (["planned", "active", "active", "paused", "completed"] as const)[
        index % 5
      ]!,
      targetDate: CalendarDate(
        DateTime.formatIso(
          DateTime.add(now, { days: (index % 90) - 14 })
        ).slice(0, 10)
      ),
      links: { owner: owners[index % owners.length]! },
    })
    projects.push(project)
  }
  for (let index = 0; index < Math.ceil(customers.length / 2); index++) {
    const project = projects[index % projects.length]!
    const status = (
      ["backlog", "planned", "inProgress", "inProgress", "done"] as const
    )[index % 5]!
    const title = `${changes[index % changes.length]} in ${project.name}`
    const issue = yield* records.repository(Issue).create({
      title,
      status,
      priority: (["normal", "normal", "low", "high", "urgent"] as const)[
        Math.floor(index / 3) % 5
      ]!,
      dueDate:
        index % 6 === 0
          ? null
          : CalendarDate(
              DateTime.formatIso(
                DateTime.add(now, { days: (index % 45) - 10 })
              ).slice(0, 10)
            ),
      description: `### Customer impact\n\n${customers[index % customers.length]!.accountName} reported this during their rollout.\n\n### Acceptance criteria\n\n- Preserve the original request and its owner.\n- Show a clear recovery step.\n- Record the result for the support team.\n\n${index % 17 === 0 ? "The issue occurs intermittently when several teammates work on the same account. Include concurrent updates and large result sets in verification.\n\n".repeat(15) : "Verify with an existing account and a newly invited teammate."}`,
      links: {
        project: project.id,
        assignee: index % 7 === 0 ? null : owners[index % owners.length]!,
      },
    })
    issues.push(issue)
  }
  return { projects, issues, owners }
})
