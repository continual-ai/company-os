import { Contact } from "#/modules/crm/model/index.ts"
import { Ticket } from "#/modules/service/model/index.ts"
import { Task } from "#/modules/work/model/index.ts"
import { Identity } from "#/runtime/access/model/index.ts"
import { defineLink, defineObject, schema } from "#/runtime/model/index.ts"
import { NoteSubject } from "#/runtime/platform/model/note-subject.ts"

export const Feedback = defineObject({
  id: "feedback",
  collection: "feedback",
  name: "Feedback",
  pluralName: "Feedback",
  description:
    "An observation, request, or report to consider. Feedback preserves the evidence independently of any work it leads to.",
  implements: [{ interface: NoteSubject }],
  properties: {
    title: schema.string({ label: "Title", minLength: 1, maxLength: 300 }),
    description: schema.string({
      label: "Description",
      description: "Preserve the original words, context, and observed impact.",
      maxLength: 50_000,
      nullable: true,
    }),
    status: schema.select({
      label: "Status",
      description:
        "Review progress, independent of the status of linked tasks.",
      default: "new",
      options: [
        { value: "new", label: "New" },
        { value: "reviewing", label: "Reviewing" },
        { value: "reviewed", label: "Reviewed" },
        { value: "deferred", label: "Deferred" },
        { value: "dismissed", label: "Dismissed" },
      ],
    }),
    source: schema.string({
      label: "Source",
      description:
        "Where this came from, such as an interview or field inspection.",
      maxLength: 300,
      nullable: true,
    }),
    sourceUrl: schema.url({ label: "Source URL", nullable: true }),
    reviewNotes: schema.string({
      label: "Review notes",
      description: "The assessment, decision, and reason for any next steps.",
      maxLength: 50_000,
      nullable: true,
    }),
    attachments: schema.array(schema.file({ maxBytes: 25_000_000 }), {
      label: "Attachments",
      default: [],
    }),
  },
  search: { fields: ["title", "description", "source", "reviewNotes"] },
  display: { title: "title", status: "status", icon: "messageSquare" },
})

export const FeedbackOwner = defineLink({
  id: "feedbackOwner",
  name: "Feedback owner",
  from: { object: Feedback, key: "owner", label: "Owner", max: 1 },
  to: { object: Identity, key: "ownedFeedback", label: "Owned feedback" },
})

export const FeedbackReporter = defineLink({
  id: "feedbackReporter",
  name: "Feedback reporter",
  from: { object: Feedback, key: "reporter", label: "Reporter", max: 1 },
  to: { object: Contact, key: "feedback", label: "Feedback" },
})

export const FeedbackTasks = defineLink({
  id: "feedbackTasks",
  name: "Feedback tasks",
  description: "Work that investigates or addresses the feedback.",
  from: { object: Feedback, key: "tasks", label: "Tasks" },
  to: { object: Task, key: "feedback", label: "Feedback" },
})

export const FeedbackTickets = defineLink({
  id: "feedbackTickets",
  name: "Feedback source tickets",
  from: { object: Feedback, key: "tickets", label: "Source tickets" },
  to: { object: Ticket, key: "feedback", label: "Feedback" },
})
