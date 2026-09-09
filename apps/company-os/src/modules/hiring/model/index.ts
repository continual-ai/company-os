import { Application } from "#/modules/hiring/model/application.ts"
import { Candidate } from "#/modules/hiring/model/candidate.ts"
import { JobPosting } from "#/modules/hiring/model/job-posting.ts"
import { defineModule } from "#/runtime/model/index.ts"

export const HiringModule = defineModule({
  description: "Manage open roles, candidates, and the hiring pipeline.",
  id: "hiring",
  name: "Hiring",
  objects: [JobPosting, Candidate, Application],
})

export { Application, Candidate, JobPosting }
