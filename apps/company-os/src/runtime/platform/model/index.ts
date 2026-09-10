import {
  User,
  ServiceAccount,
  AnonymousActor,
  Identity,
} from "#/runtime/access/model/index.ts"
import { Asset } from "#/runtime/assets/model/asset.ts"
import { defineModule } from "#/runtime/model/index.ts"
import { ModuleSetting } from "#/runtime/platform/model/module-setting.ts"

export const PlatformModule = defineModule({
  maturity: "alpha",
  origin: {
    name: "Company OS",
    url: "https://github.com/continual-ai/company-os",
  },
  id: "platform",
  name: "Platform",
  interfaces: [Identity],
  objects: [User, ServiceAccount, AnonymousActor, Asset, ModuleSetting],
  description: "Core identities, files, and application capabilities.",
})
export { ModuleSetting }
export const requiredModuleIds = ["platform"] as const

export { moduleActivationPlan } from "#/runtime/platform/model/activation.ts"
