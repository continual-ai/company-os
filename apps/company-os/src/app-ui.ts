import { AccessUi } from "./modules/access/ui"
import { EngineeringUi } from "./modules/engineering/ui"
import { MarketingUi } from "./modules/marketing/ui"
import { SalesUi } from "./modules/sales/ui"
import { SupportUi } from "./modules/support/ui"
import { composeModelUi } from "./ui/model/module-ui"

export const modelUi = composeModelUi(
  AccessUi,
  SalesUi,
  MarketingUi,
  SupportUi,
  EngineeringUi
)
