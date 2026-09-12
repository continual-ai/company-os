import { moduleMaturities } from "#/runtime/model/definition/module.ts"
import {
  defineObject,
  schema,
  standardErrors,
  defineAction,
  defineQuery,
} from "#/runtime/model/index.ts"

export const ModuleSetting = defineObject({
  id: "moduleSetting",
  collection: "moduleSettings",
  name: "Module",
  pluralName: "Modules",
  description:
    "Activation of a capability installed in this application. Disabling preserves its records.",
  properties: {
    moduleId: schema.string({ label: "Module", immutable: true }),
    enabled: schema.boolean({ label: "Enabled" }),
  },
  uniqueBy: { module: ["moduleId"] },
  actions: { create: false, update: false, delete: false, batchDelete: false },
  display: { title: "moduleId", icon: "settings" },
})
export const SetModuleEnabled = defineAction({
  id: "setEnabled",
  collection: ModuleSetting,
  name: "Set module availability",
  description:
    "Enable a module and its dependencies, or disable it with explicitly confirmed dependent modules. Records are preserved.",
  idempotent: true,
  input: {
    moduleId: schema.string(),
    enabled: schema.boolean(),
    disableDependents: schema.optional(schema.array(schema.string())),
  },
  output: { enabledModules: schema.array(schema.string()) },
  errors: [standardErrors.failedPrecondition],
})
export const ModuleCatalog = defineQuery({
  id: "catalog",
  collection: ModuleSetting,
  name: "Browse modules",
  description:
    "Discover installed capabilities, their dependencies, and current availability.",
  output: {
    modules: schema.array(
      schema.object({
        id: schema.string(),
        name: schema.string(),
        description: schema.string(),
        maturity: schema.optional(schema.enumeration(moduleMaturities)),
        maintainer: schema.optional(
          schema.object({
            name: schema.string(),
            email: schema.optional(schema.string()),
          })
        ),
        origin: schema.optional(
          schema.object({
            name: schema.string(),
            url: schema.optional(schema.string()),
          })
        ),
        enabled: schema.boolean(),
        required: schema.boolean(),
        dependencies: schema.array(schema.string()),
        objects: schema.array(schema.string()),
      })
    ),
  },
})
