import { defineObject, schema } from "@company/runtime"

import { Repository } from "#modules/engineering/repository/model"
import { NoteSubject } from "#modules/sales/interfaces/note-subject"
import { Root } from "#root"

export const PullRequest = defineObject({
  id: "pullRequest",
  collection: "pullRequests",
  name: "Pull request",
  pluralName: "Pull requests",
  description:
    "A proposed code change and its observed review and check state. The source provider remains authoritative for merge execution.",
  parent: Root,
  implements: [{ interface: NoteSubject }],
  properties: {
    title: schema.string({ label: "Title", maxLength: 300, minLength: 1 }),
    repository: schema.reference(Repository, {
      label: "Repository",
      inverse: { key: "pullRequests", label: "Pull requests" },
    }),
    number: schema.number({
      label: "Number",
      nullable: true,
      integer: true,
      minimum: 1,
    }),
    url: schema.url({ label: "URL", nullable: true }),
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
      default: "pending",
      options: [
        { value: "pending", label: "Pending" },
        { value: "changesRequested", label: "Changes requested" },
        { value: "approved", label: "Approved" },
      ],
    }),
    checks: schema.select({
      label: "Checks",
      default: "pending",
      options: [
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
    observedAt: schema.timestamp({ label: "Last observed", nullable: true }),
  },
  display: { title: "title", icon: "gitPullRequest", status: "status" },
})
