import { Effect } from "effect"

import { defineModuleServer } from "@/server/model/module-server"

import { pipelineSummary } from "./deal/server/pipeline-summary"
import { convertLead } from "./lead/server/convert"
import { SalesModule } from "./model"

export const SalesServer = defineModuleServer(
  SalesModule,
  Effect.succeed({
    lead: { convert: convertLead },
    deal: { pipelineSummary },
  })
)
