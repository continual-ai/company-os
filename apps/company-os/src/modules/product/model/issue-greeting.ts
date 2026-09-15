import { Issue } from "#/modules/product/model/issue.ts"
import { defineController } from "#/runtime/model/index.ts"

export const IssueGreeting = defineController({
  id: "issue-greeting",
  name: "Issue greeting",
  description:
    "Ensures each issue has a Hello world note. Demonstrates durable, idempotent reconciliation.",
  object: Issue,
  schedule: { cron: "*/15 * * * *", timeZone: "UTC" },
  minInterval: "1 second",
  watch: ["noteSubjects.linked", "noteSubjects.unlinked", "note.updated"],
})
