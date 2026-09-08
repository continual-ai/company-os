import { notesUi } from "@company/notes/ui"

import { Model } from "#/app.model.ts"
import { AccessUi } from "#/modules/access/ui.ts"
import { EngineeringUi } from "#/modules/engineering/ui.ts"
import { MarketingUi } from "#/modules/marketing/ui.ts"
import { SalesUi } from "#/modules/sales/ui.ts"
import { SupportUi } from "#/modules/support/ui.ts"
import { composeModelUi, defineModuleUi } from "#/ui/model/module-ui.tsx"

export const modelUi = composeModelUi(
  AccessUi,
  SalesUi,
  defineModuleUi(Model.modules.notes, notesUi),
  MarketingUi,
  SupportUi,
  EngineeringUi
)
