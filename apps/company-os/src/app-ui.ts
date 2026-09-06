import { AccessUi } from "./modules/access/ui"
import { EngineeringUi } from "./modules/engineering/ui"
import { SalesUi } from "./modules/sales/ui"
import { composeModelUi } from "./ui/model/module-ui"

export const modelUi = composeModelUi(AccessUi, SalesUi, EngineeringUi)
