import { HiringModule } from "#/modules/hiring/model/index.ts"
import { applicationUi } from "#/modules/hiring/ui/application/config.ts"
import { candidateUi } from "#/modules/hiring/ui/candidate/config.ts"
import { jobPostingUi } from "#/modules/hiring/ui/job-posting/config.ts"
import { defineModuleUi } from "#/runtime/ui/module.ts"

export const HiringUi = defineModuleUi(HiringModule, {
  application: applicationUi,
  candidate: candidateUi,
  jobPosting: jobPostingUi,
})
