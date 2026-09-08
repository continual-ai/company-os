import { AssetsModule } from "#/model/assets.ts"
import { defineModuleUi } from "#/ui/model/module-ui.tsx"

/** Files are managed through record fields; apps can supply a dedicated library. */
export const AssetsUi = defineModuleUi(AssetsModule, {
  asset: { navigation: { hidden: true } },
})
