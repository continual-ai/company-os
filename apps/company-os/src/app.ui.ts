import { Model } from "#/app.model.ts"
import { EngineeringUi } from "#/modules/engineering/ui/index.ts"
import { HiringUi } from "#/modules/hiring/ui/index.ts"
import { MarketingUi } from "#/modules/marketing/ui/index.ts"
import { NotesUi } from "#/modules/notes/ui/index.ts"
import { PlatformUi } from "#/modules/platform/ui/index.ts"
import { SalesUi } from "#/modules/sales/ui/index.ts"
import { SupportUi } from "#/modules/support/ui/index.ts"
import { AccessUi } from "#/runtime/access/ui/index.ts"
import { AssetsUi } from "#/runtime/assets/ui/index.ts"
import { composeModelUi } from "#/runtime/ui/model/module-ui.tsx"

/** Presentation contributions for the modules composed in app.model.ts. */
export const modelUi = composeModelUi(
  Model,
  PlatformUi,
  AccessUi,
  AssetsUi,
  NotesUi,
  SalesUi,
  MarketingUi,
  EngineeringUi,
  HiringUi,
  SupportUi
)
