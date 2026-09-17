import { GitHubRepository } from "#/modules/engineering/model/github-repository.ts"
import { defineLink, defineObject, schema } from "#/runtime/model/index.ts"
import { ControllerTarget } from "#/runtime/platform/model/controller-instance.ts"
import { NoteSubject } from "#/runtime/platform/model/note-subject.ts"

export const GitHubPullRequest = defineObject({
  id: "githubPullRequest",
  collection: "githubPullRequests",
  name: "GitHub pull request",
  pluralName: "GitHub pull requests",
  description:
    "Track a code change, its reviews, and checks. Merge it in GitHub.",
  implements: [{ interface: ControllerTarget }, { interface: NoteSubject }],
  properties: {
    nodeId: schema.string({
      label: "GitHub node ID",
      minLength: 1,
      maxLength: 200,
    }),
    body: schema.markdown({ label: "Body", nullable: true, maxLength: 100000 }),
    title: schema.string({ label: "Title", maxLength: 300, minLength: 1 }),
    number: schema.number({
      label: "Number",
      integer: true,
      minimum: 1,
    }),
    url: schema.url({ label: "URL" }),
    status: schema.select({
      label: "Status",
      default: "draft",
      options: [
        { value: "draft", label: "Draft" },
        { value: "open", label: "Open" },
        { value: "merged", label: "Merged" },
        { value: "closed", label: "Closed" },
      ],
    }),
    review: schema.select({
      label: "Review",
      default: "unknown",
      options: [
        { value: "unknown", label: "Not fetched" },
        { value: "pending", label: "Pending" },
        { value: "changesRequested", label: "Changes requested" },
        { value: "approved", label: "Approved" },
      ],
    }),
    checks: schema.select({
      label: "Checks",
      default: "unknown",
      options: [
        { value: "unknown", label: "Not fetched" },
        { value: "pending", label: "Pending" },
        { value: "passing", label: "Passing" },
        { value: "failing", label: "Failing" },
      ],
    }),
    headCommit: schema.string({
      label: "Head commit",
      maxLength: 300,
      nullable: true,
    }),
  },
  uniqueBy: { github: ["nodeId"], number: ["repository", "number"] },
  search: { fields: ["title", "body", "url", "headCommit"] },
  display: { title: "title", icon: "gitPullRequest", status: "status" },
})

export const GitHubPullRequestRepository = defineLink({
  id: "githubPullRequestRepository",
  name: "GitHub pull request repository",
  from: {
    object: GitHubPullRequest,
    key: "repository",
    label: "Repository",
    min: 1,
    max: 1,
  },
  to: { object: GitHubRepository, key: "pullRequests", label: "Pull requests" },
})
