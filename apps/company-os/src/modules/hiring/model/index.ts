import {
  Application,
  ApplicationCandidate,
  ApplicationJob,
} from "#/modules/hiring/model/application.ts"
import { Candidate } from "#/modules/hiring/model/candidate.ts"
import {
  JobPosting,
  JobPostingHiringManager,
} from "#/modules/hiring/model/job-posting.ts"
import { defineModule } from "#/runtime/model/index.ts"

export const HiringModule = defineModule({
  maturity: "alpha",
  origin: {
    name: "Company OS",
    url: "https://github.com/continual-ai/company-os",
  },
  description: "Manage open roles, candidates, and the hiring pipeline.",
  id: "hiring",
  name: "Hiring",
  objects: [JobPosting, Candidate, Application],
  links: [ApplicationJob, ApplicationCandidate, JobPostingHiringManager],
})

export { Application, Candidate, JobPosting }
