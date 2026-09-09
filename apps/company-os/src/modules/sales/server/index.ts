import { SalesModule } from "#/modules/sales/model/index.ts"
import { convertLead } from "#/modules/sales/server/convert-lead.ts"
import { pipelineSummary } from "#/modules/sales/server/pipeline-summary.ts"
import { defineModuleServer } from "#/runtime/server/index.ts"

export const SalesServer = defineModuleServer(SalesModule, {
  lead: { convert: convertLead },
  deal: { pipelineSummary },
})
export { convertLead, pipelineSummary }
