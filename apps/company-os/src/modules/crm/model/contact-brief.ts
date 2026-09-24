import { Contact } from "#/modules/crm/model/contact.ts"
import {
  defineAction,
  defineLink,
  defineObject,
  schema,
  standardErrors,
} from "#/runtime/model/index.ts"

export const ContactBrief = defineObject({
  id: "contactBrief",
  collection: "contactBriefs",
  name: "Contact brief",
  pluralName: "Contact briefs",
  description:
    "A durable request and result for a platform-managed contact brief.",
  properties: {
    requestKey: schema.string({ maxLength: 100, minLength: 1 }),
    status: schema.select({
      default: "pending",
      options: [
        { value: "pending", label: "Pending" },
        { value: "running", label: "Running" },
        { value: "completed", label: "Completed" },
        { value: "stale", label: "Context changed" },
        { value: "failed", label: "Failed" },
      ],
    }),
    threadId: schema.string({ nullable: true }),
    leaseToken: schema.string({ nullable: true }),
    leaseExpiresAt: schema.timestamp({ nullable: true }),
    inputRevision: schema.string({ nullable: true }),
    result: schema.markdown({ nullable: true, maxLength: 10000 }),
    error: schema.string({ nullable: true, maxLength: 2000 }),
  },
  uniqueBy: { request: ["contact", "requestKey"] },
  actions: { create: false, update: false, delete: false, batchDelete: false },
  display: { title: ["contact.name"], status: "status", icon: "fileText" },
})

export const ContactBriefContact = defineLink({
  id: "contactBriefContact",
  outputOnly: true,
  from: { object: ContactBrief, key: "contact", min: 1, max: 1 },
  to: { object: Contact, key: "briefs", label: "Briefs", onDelete: "cascade" },
})

const errors = [
  standardErrors.aborted,
  standardErrors.failedPrecondition,
  standardErrors.alreadyExists,
]

export const RequestContactBrief = defineAction({
  id: "requestBrief",
  record: Contact,
  name: "Request brief",
  description:
    "Queues a contact brief. Reuse the request key when retrying the same request.",
  idempotent: true,
  errors,
  input: {
    id: schema.id(Contact),
    requestKey: schema.string({ minLength: 1, maxLength: 100 }),
  },
  output: { briefId: schema.id(ContactBrief) },
})

export const BeginContactBrief = defineAction({
  id: "begin",
  record: ContactBrief,
  name: "Begin brief",
  description:
    "Claims pending work or an expired lease for 15 minutes and returns current context. Paginate contactBrief.list to find work. A running lease prevents overlapping writes.",
  errors,
  input: {
    id: schema.id(ContactBrief),
    threadId: schema.string({ minLength: 1, maxLength: 200 }),
  },
  output: {
    leaseToken: schema.string(),
    inputRevision: schema.string(),
    context: schema.json(),
  },
})

export const CompleteContactBrief = defineAction({
  id: "complete",
  record: ContactBrief,
  name: "Complete brief",
  description:
    "Atomically saves the brief and contact summary if the lease and source revision are current. A changed source marks the work stale without changing the summary. Repeating the same completion is safe.",
  idempotent: true,
  errors,
  input: {
    id: schema.id(ContactBrief),
    leaseToken: schema.string(),
    inputRevision: schema.string(),
    summary: schema.markdown({ minLength: 1, maxLength: 10000 }),
  },
  output: { status: schema.enumeration(["completed", "stale"]) },
})

export const FailContactBrief = defineAction({
  id: "fail",
  record: ContactBrief,
  name: "Report brief failure",
  description:
    "Records a business-visible failure for the current lease. Omit credentials and private source content from the error.",
  idempotent: true,
  errors,
  input: {
    id: schema.id(ContactBrief),
    leaseToken: schema.string(),
    error: schema.string({ minLength: 1, maxLength: 2000 }),
  },
  output: {},
})
