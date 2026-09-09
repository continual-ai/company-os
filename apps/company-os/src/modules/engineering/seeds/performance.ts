import { DateTime, Effect } from "effect"

import { Issue } from "#/modules/engineering/model/issue.ts"
import { Project } from "#/modules/engineering/model/project.ts"
import { PullRequest } from "#/modules/engineering/model/pull-request.ts"
import { Repository } from "#/modules/engineering/model/repository.ts"
import type { SalesSeedData } from "#/modules/sales/seeds/index.ts"
import { CalendarDate, Timestamp, WebUrl } from "#/runtime/model/index.ts"
import { Records } from "#/runtime/server/index.ts"
import { linkSeedRecords } from "#/runtime/server/seeds.ts"

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
  "Support international company names",
  "Keep approval history after reassignment",
]

export const seedEngineeringPerformance = Effect.fn(
  "@company/seedEngineeringPerformance"
)(function* ({ customers, owners }: SalesSeedData) {
  const now = yield* DateTime.now
  const records = yield* Records
  const projects = []
  const repositories = []
  const companies = [
    ...new Map(
      customers.map((customer) => [customer.company, customer.companyName])
    ).values(),
  ]
  for (
    let index = 0;
    index < Math.max(4, Math.ceil(customers.length / 20));
    index++
  ) {
    const project = yield* records.writer(Project).create({
      name: `${workstreams[index % workstreams.length]} — ${companies[index % companies.length]}`,
      objective:
        "Reduce manual follow-up and make the next step clear for customers and the operations team.",
      owner: owners[index % owners.length]!,
      status: (["planned", "active", "active", "paused", "completed"] as const)[
        index % 5
      ]!,
      targetDate: CalendarDate(
        DateTime.formatIso(
          DateTime.add(now, { days: (index % 90) - 14 })
        ).slice(0, 10)
      ),
    })
    projects.push(project)
    repositories.push(
      yield* records.writer(Repository).create({
        name: `${companies[index % companies.length]} — ${workstreams[index % workstreams.length]} service`,
        project: project.id,
        owner: owners[index % owners.length]!,
        url: WebUrl(`https://code.example.test/engineering/service-${index}`),
      })
    )
  }
  for (let index = 0; index < Math.ceil(customers.length / 2); index++) {
    const project = projects[index % projects.length]!
    const repository = repositories[index % repositories.length]!
    const status = (
      ["backlog", "planned", "inProgress", "inProgress", "done"] as const
    )[index % 5]!
    const title = `${changes[index % changes.length]} in ${project.name}`
    const issue = yield* records.writer(Issue).create({
      title,
      project: project.id,
      status,
      priority: (["normal", "normal", "low", "high", "urgent"] as const)[
        Math.floor(index / 3) % 5
      ]!,
      assignee: index % 7 === 0 ? null : owners[index % owners.length]!,
      dueDate:
        index % 6 === 0
          ? null
          : CalendarDate(
              DateTime.formatIso(
                DateTime.add(now, { days: (index % 45) - 10 })
              ).slice(0, 10)
            ),
      description: `### Customer impact\n\n${customers[index % customers.length]!.companyName} reported this during their rollout.\n\n### Acceptance criteria\n\n- Preserve the original request and its owner.\n- Show a clear recovery step.\n- Record the result for the support team.\n\n${index % 17 === 0 ? "The issue occurs intermittently when several teammates work on the same account. Include concurrent updates and large result sets in verification.\n\n".repeat(15) : "Verify with an existing account and a newly invited teammate."}`,
    })
    const prStatus =
      status === "done"
        ? "merged"
        : (["draft", "open", "open", "closed"] as const)[index % 4]!
    const pr = yield* records.writer(PullRequest).create({
      title,
      repository: repository.id,
      number: 100 + index,
      url: WebUrl(
        `https://code.example.test/engineering/service-${index % repositories.length}/pull/${100 + index}`
      ),
      status: prStatus,
      review:
        prStatus === "merged"
          ? "approved"
          : (["pending", "changesRequested", "approved"] as const)[index % 3]!,
      checks:
        prStatus === "merged"
          ? "passing"
          : (["pending", "passing", "failing"] as const)[
              Math.floor(index / 2) % 3
            ]!,
      observedAt: Timestamp(
        DateTime.formatIso(DateTime.subtract(now, { hours: index % 48 }))
      ),
    })
    yield* linkSeedRecords(Issue, "pullRequests", issue.id, pr.id)
  }
  yield* Effect.log(
    "Prepared engineering projects, repositories, issues, and pull requests."
  )
})
