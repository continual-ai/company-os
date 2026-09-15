import {
  defineObject,
  defineLink,
  RecordAlias,
  schema,
} from "#/runtime/model/index.ts"
import { ModuleSetting } from "#/runtime/platform/model/module-setting.ts"

export const Controller = defineObject({
  id: "controller",
  collection: "controllers",
  name: "Controller",
  pluralName: "Controllers",
  description:
    "A code-defined operation that continuously reconciles records toward a desired state.",
  properties: {
    paused: schema.boolean({ default: false }),
    definitionId: schema.string({
      label: "Definition ID",
      immutable: true,
      outputOnly: true,
    }),
    name: schema.string({ outputOnly: true }),
    description: schema.string({ outputOnly: true }),
    targetObjectType: schema.string({
      label: "Target object type",
      outputOnly: true,
    }),
    scope: schema.enumeration(["object", "collection"], { outputOnly: true }),
    watch: schema.array(schema.string(), {
      label: "Watched events",
      outputOnly: true,
    }),
    schedule: schema.object(
      { cron: schema.string(), timeZone: schema.string() },
      { nullable: true, label: "Rescan schedule", outputOnly: true }
    ),
    minInterval: schema.string({
      nullable: true,
      label: "Minimum interval per key",
      outputOnly: true,
    }),
  },
  uniqueBy: { definition: ["definitionId"] },
  actions: { create: false, delete: false, batchDelete: false },
  display: { title: "name", icon: "refreshCw" },
})

export const ControllerModule = defineLink({
  id: "controllerModule",
  name: "Controller Module",
  outputOnly: true,
  from: { type: Controller, key: "module", label: "Module", min: 1, max: 1 },
  to: { type: ModuleSetting, key: "controllers", label: "Controllers" },
})

/** Stable identities for the code-owned registry, independent of display names. */
export const controllerAlias = (definitionId: string) =>
  RecordAlias(`system:controller:${definitionId}`)
