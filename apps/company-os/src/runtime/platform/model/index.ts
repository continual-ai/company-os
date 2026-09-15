import {
  User,
  ServiceAccount,
  AnonymousActor,
  Identity,
} from "#/runtime/access/model/index.ts"
import {
  Asset,
  BeginAssetUpload,
  CompleteAssetUpload,
} from "#/runtime/assets/model/asset.ts"
import { defineModule, defineModel } from "#/runtime/model/index.ts"
import { ControllerStatus } from "#/runtime/platform/model/controller-status.ts"
import {
  Controller,
  ControllerModule,
} from "#/runtime/platform/model/controller.ts"
import {
  ModuleSetting,
  SetModuleEnabled,
  ModuleCatalog,
} from "#/runtime/platform/model/module-setting.ts"
import {
  ReconcileController,
  ControllerReconciliationRequested,
} from "#/runtime/platform/model/reconcile-controller.ts"

export const PlatformModule = defineModule({
  maturity: "alpha",
  origin: {
    name: "Company OS",
    url: "https://github.com/continual-ai/company-os",
  },
  id: "platform",
  name: "Platform",
  interfaces: [Identity],
  objects: [
    User,
    ServiceAccount,
    AnonymousActor,
    Asset,
    ModuleSetting,
    Controller,
  ],
  description: "Core identities, files, and application capabilities.",
  links: [ControllerModule],
  queries: [ModuleCatalog, ControllerStatus],
  actions: [
    BeginAssetUpload,
    CompleteAssetUpload,
    SetModuleEnabled,
    ReconcileController,
  ],
  events: [ControllerReconciliationRequested],
})
export { ModuleSetting }
export const requiredModuleIds = ["platform"] as const

export { moduleActivationPlan } from "#/runtime/platform/model/activation.ts"

/** The portable kernel contract used by its own UI; applications compose the same module. */
export const PlatformModel = defineModel({
  name: "Platform",
  modules: [PlatformModule],
})
