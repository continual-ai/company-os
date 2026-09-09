import { PlatformModule } from "#/modules/platform/model/index.ts"
import { defineModuleUi } from "#/runtime/ui/module.ts"

export const PlatformUi = defineModuleUi(PlatformModule, {
  moduleSetting: { navigation: { hidden: true } },
})
