import { AccessUi } from "@company/runtime/ui/access"
import { AssetsUi } from "@company/runtime/ui/assets"
import { composeModelUi } from "@company/runtime/ui/model/module-ui"

import { Model } from "#/app.model.ts"
export const modelUi = composeModelUi(Model, AccessUi, AssetsUi)
