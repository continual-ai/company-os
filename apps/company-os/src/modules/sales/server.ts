import { Effect } from "effect"

import { pipelineSummary } from "#/modules/sales/deal/server/pipeline-summary.ts"
import { convertLead } from "#/modules/sales/lead/server/convert.ts"
import { SalesModule } from "#/modules/sales/model.ts"
import { defineModuleServer } from "#/server/model/module-server.ts"

export const SalesServer = defineModuleServer(
  SalesModule,
  Effect.succeed({
    lead: { convert: convertLead },
    deal: { pipelineSummary },
  })
)
