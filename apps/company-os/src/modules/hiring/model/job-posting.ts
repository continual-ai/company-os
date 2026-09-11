import { NoteSubject } from "#/modules/notes/model/index.ts"
import { User } from "#/runtime/access/model/index.ts"
import { defineLink, defineObject, schema } from "#/runtime/model/index.ts"

export const JobPosting = defineObject({
  id: "jobPosting",
  collection: "jobPostings",
  name: "Job posting",
  pluralName: "Job postings",
  description: "A role your company is hiring for.",
  implements: [{ interface: NoteSubject }],
  properties: {
    title: schema.string({ label: "Title", minLength: 1, maxLength: 300 }),
    description: schema.string({
      label: "Description",
      minLength: 1,
      maxLength: 50_000,
    }),
    department: schema.string({
      label: "Department",
      maxLength: 200,
      nullable: true,
    }),
    location: schema.string({
      label: "Location",
      maxLength: 300,
      nullable: true,
    }),
    employmentType: schema.select({
      label: "Employment type",
      default: "fullTime",
      options: [
        { value: "fullTime", label: "Full time" },
        { value: "partTime", label: "Part time" },
        { value: "contract", label: "Contract" },
        { value: "temporary", label: "Temporary" },
        { value: "internship", label: "Internship" },
      ],
    }),
    status: schema.select({
      label: "Status",
      default: "draft",
      options: [
        { value: "draft", label: "Draft" },
        { value: "open", label: "Open" },
        { value: "paused", label: "Paused" },
        { value: "closed", label: "Closed" },
      ],
    }),
    // These dates are manually recorded, not side effects of status updates.
    publishedAt: schema.timestamp({
      label: "Published at (manual)",
      nullable: true,
    }),
    closedAt: schema.timestamp({
      label: "Closed at (manual)",
      nullable: true,
    }),
  },
  search: { fields: ["title", "description", "department", "location"] },
  display: { icon: "briefcaseBusiness", title: "title", status: "status" },
})

export const JobPostingHiringManager = defineLink({
  id: "jobPostingHiringManager",
  name: "JobPosting Hiring manager",
  from: JobPosting,
  to: User,
  forward: { key: "hiringManager", label: "Hiring manager", max: 1 },
  reverse: { key: "jobPostings", label: "Job postings" },
})
