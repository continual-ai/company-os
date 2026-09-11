import { Candidate } from "#/modules/hiring/model/candidate.ts"
import { JobPosting } from "#/modules/hiring/model/job-posting.ts"
import { NoteSubject } from "#/modules/notes/model/index.ts"
import { defineLink, defineObject, schema } from "#/runtime/model/index.ts"

export const Application = defineObject({
  id: "application",
  collection: "applications",
  name: "Application",
  pluralName: "Applications",
  description: "A candidate's application for a specific job posting.",
  implements: [{ interface: NoteSubject }],
  uniqueBy: { candidateJob: ["candidate", "job"] },
  properties: {
    stage: schema.select({
      label: "Stage",
      default: "new",
      options: [
        { value: "new", label: "New" },
        { value: "reviewing", label: "Reviewing" },
        { value: "phoneScreen", label: "Phone screen" },
        { value: "interview", label: "Interview" },
        { value: "offer", label: "Offer" },
        { value: "hired", label: "Hired" },
        { value: "rejected", label: "Rejected" },
        { value: "withdrawn", label: "Withdrawn" },
      ],
    }),
    source: schema.select({
      label: "Source",
      default: "unknown",
      options: [
        { value: "unknown", label: "Unknown" },
        { value: "careersPage", label: "Careers page" },
        { value: "referral", label: "Referral" },
        { value: "recruiter", label: "Recruiter" },
        { value: "outbound", label: "Outbound" },
        { value: "other", label: "Other" },
      ],
    }),
    coverLetter: schema.string({
      label: "Cover letter",
      maxLength: 50_000,
      nullable: true,
    }),
    resume: schema.file({
      label: "Resume",
      maxBytes: 25_000_000,
      nullable: true,
    }),
    rating: schema.number({
      label: "Rating",
      integer: true,
      minimum: 1,
      maximum: 5,
      nullable: true,
    }),
    reviewNotes: schema.string({
      label: "Review notes",
      maxLength: 20_000,
      nullable: true,
    }),
  },
  search: { fields: ["coverLetter", "reviewNotes"] },
  display: { icon: "clipboardCheck", title: "id", status: "stage" },
})

export const ApplicationJob = defineLink({
  id: "applicationJob",
  name: "Application Job posting",
  from: Application,
  to: JobPosting,
  forward: { key: "job", label: "Job posting", min: 1, max: 1 },
  reverse: { key: "applications", label: "Applications" },
})

export const ApplicationCandidate = defineLink({
  id: "applicationCandidate",
  name: "Application Candidate",
  from: Application,
  to: Candidate,
  forward: { key: "candidate", label: "Candidate", min: 1, max: 1 },
  reverse: { key: "applications", label: "Applications" },
})
