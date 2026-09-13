import { Model } from "#/app.model.ts"
import { CrmUi } from "#/modules/crm/ui/index.ts"
import { EngineeringUi } from "#/modules/engineering/ui/index.ts"
import { HiringUi } from "#/modules/hiring/ui/index.ts"
import { MarketingUi } from "#/modules/marketing/ui/index.ts"
import { NotesUi } from "#/modules/notes/ui/index.ts"
import { ProductUi } from "#/modules/product/ui/index.ts"
import { SalesUi } from "#/modules/sales/ui/index.ts"
import { ServiceUi } from "#/modules/service/ui/index.ts"
import { PlatformUi } from "#/runtime/platform/ui/index.ts"
import { composeModelUi } from "#/runtime/ui/model/module-ui.tsx"

/** Presentation contributions for the modules composed in app.model.ts. */
export const modelUi = composeModelUi(
  Model,
  PlatformUi,
  NotesUi,
  CrmUi,
  SalesUi,
  MarketingUi,
  ProductUi,
  EngineeringUi,
  HiringUi,
  ServiceUi
)
