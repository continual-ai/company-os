import { ModuleSetting } from "#/modules/platform/model/module-setting.ts"
import { defineModule } from "#/runtime/model/index.ts"

export const PlatformModule = defineModule({
  id: "platform",
  name: "Platform",
  objects: [ModuleSetting],
  description: "Choose the capabilities available in your application.",
})
export { ModuleSetting }
export const requiredModuleIds = ["access", "assets", "platform"] as const

export { moduleActivationPlan } from "#/modules/platform/model/activation.ts"
