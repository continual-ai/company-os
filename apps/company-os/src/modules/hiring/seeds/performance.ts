import { Effect } from "effect"

import { Application } from "#/modules/hiring/model/application.ts"
import { Candidate } from "#/modules/hiring/model/candidate.ts"
import { JobPosting } from "#/modules/hiring/model/job-posting.ts"
import { EmailAddress, WebUrl } from "#/runtime/model/index.ts"
import type { RecordId } from "#/runtime/model/index.ts"
import { Records } from "#/runtime/server/index.ts"

const departments = ["Engineering", "Operations", "Growth", "Finance"]
const locations = ["Remote", "New York", "San Francisco", "London"]
const stages = [
  "new",
  "reviewing",
  "phoneScreen",
  "interview",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
] as const

/** Supplies linked hiring records for the development performance dataset. */
export const seedHiringPerformance = Effect.fn(
  "@company/seedHiringPerformance"
)(function* (size: number, owners: ReadonlyArray<RecordId<"user">>) {
  const records = yield* Records
  for (let index = 0; index < size; index++) {
    const job = yield* records.writer(JobPosting).create({
      department: departments[index % departments.length]!,
      description:
        "Build a durable business operation and make the next step clear for the team.",
      hiringManager: owners[index % owners.length]!,
      location: locations[index % locations.length]!,
      status: index % 7 === 0 ? "paused" : "open",
      title: `${["Senior", "Staff", "Lead"][index % 3]} ${["Engineer", "Operator", "Designer", "Recruiter"][index % 4]}`,
    })
    const candidate = yield* records.writer(Candidate).create({
      email: EmailAddress(`candidate-${index}@hiring.example.test`),
      name: `Candidate ${index + 1}`,
      linkedinUrl:
        index % 3 === 0
          ? WebUrl(`https://www.linkedin.com/in/candidate-${index}`)
          : null,
    })
    yield* records.writer(Application).create({
      candidate: candidate.id,
      job: job.id,
      rating: index % 5 === 0 ? null : (index % 5) + 1,
      reviewNotes:
        index % 4 === 0 ? "Strong evidence of ownership in prior work." : null,
      source: (["careersPage", "referral", "recruiter", "outbound"] as const)[
        index % 4
      ]!,
      stage: stages[index % stages.length]!,
    })
  }
  yield* Effect.log(
    `Prepared ${size} hiring jobs, candidates, and applications.`
  )
})
