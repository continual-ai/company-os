import { GitHubRepository } from "#/modules/engineering/model/github-repository.ts"
import { defineLink, defineObject, schema } from "#/runtime/model/index.ts"
import { ControllerTarget } from "#/runtime/platform/model/controller-instance.ts"
import { NoteSubject } from "#/runtime/platform/model/note-subject.ts"

export const GitHubIssue = defineObject({
  id: "githubIssue",
  collection: "githubIssues",
  name: "GitHub issue",
  pluralName: "GitHub issues",
  description:
    "An issue tracked in GitHub, separate from internal product planning.",
  implements: [{ interface: ControllerTarget }, { interface: NoteSubject }],
  properties: {
    nodeId: schema.string({
      label: "GitHub node ID",
      minLength: 1,
      maxLength: 200,
    }),
    number: schema.number({ label: "Number", integer: true, minimum: 1 }),
    title: schema.string({ label: "Title", minLength: 1, maxLength: 300 }),
    body: schema.markdown({ label: "Body", nullable: true, maxLength: 100000 }),
    url: schema.url({ label: "URL" }),
    state: schema.select({
      label: "State",
      default: "open",
      options: [
        { value: "open", label: "Open" },
        { value: "closed", label: "Closed" },
      ],
    }),
  },
  uniqueBy: { github: ["nodeId"], number: ["repository", "number"] },
  search: { fields: ["title", "body", "url"] },
  display: { title: "title", icon: "circleDot", status: "state" },
})

export const GitHubIssueRepository = defineLink({
  id: "githubIssueRepository",
  name: "GitHub issue repository",
  from: {
    object: GitHubIssue,
    key: "repository",
    label: "Repository",
    min: 1,
    max: 1,
  },
  to: { object: GitHubRepository, key: "issues", label: "GitHub issues" },
})
