import { EngineeringUi } from "@company/engineering/ui"
import { MarketingUi } from "@company/marketing/ui"
import { NotesUi } from "@company/notes/ui"
import type { ModelCatalog } from "@company/runtime/model"
import { AccessUi } from "@company/runtime/ui/access"
import { AssetsUi } from "@company/runtime/ui/assets"
import { composeModelUi } from "@company/runtime/ui/model/module-ui"
import { SalesUi } from "@company/sales/ui"

import { Model } from "#/examples/model.ts"
import { SupportEngineeringUi } from "#/modules/support-engineering/ui/index.ts"
import { SupportUi } from "#/modules/support/ui/index.ts"

function createAppUi(model: ModelCatalog) {
  return composeModelUi(
    model,
    AssetsUi,
    AccessUi,
    SalesUi,
    NotesUi,
    MarketingUi,
    SupportUi,
    EngineeringUi,
    SupportEngineeringUi
  )
}

export const modelUi = createAppUi(Model)
