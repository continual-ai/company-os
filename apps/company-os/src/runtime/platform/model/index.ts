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
import {
  ControllerTarget,
  ControllerInstance,
  ControllerInstanceController,
  ControllerInstanceRecord,
} from "#/runtime/platform/model/controller-instance.ts"
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
import { NoteSubject } from "#/runtime/platform/model/note-subject.ts"
import { Note, NoteSubjects } from "#/runtime/platform/model/note.ts"
import {
  ReconcileController,
  ReconcileControllerInstance,
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
  interfaces: [Identity, NoteSubject, ControllerTarget],
  objects: [
    User,
    ServiceAccount,
    AnonymousActor,
    Asset,
    Note,
    ModuleSetting,
    Controller,
    ControllerInstance,
  ],
  description:
    "Core identities, files, shared notes, and application capabilities.",
  links: [
    ControllerModule,
    NoteSubjects,
    ControllerInstanceController,
    ControllerInstanceRecord,
  ],
  queries: [ModuleCatalog, ControllerStatus],
  actions: [
    BeginAssetUpload,
    CompleteAssetUpload,
    SetModuleEnabled,
    ReconcileController,
    ReconcileControllerInstance,
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
