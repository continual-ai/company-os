import { defineModuleServer } from "@company/runtime/server"

import { SalesModule } from "#/model/index.ts"
import { convertLead } from "#/server/convert-lead.ts"
import { pipelineSummary } from "#/server/pipeline-summary.ts"

export const SalesServer = defineModuleServer(SalesModule, {
  lead: { convert: convertLead },
  deal: { pipelineSummary },
})
export { convertLead, pipelineSummary }
