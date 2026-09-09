import { defineObject, schema, standardErrors } from "#/runtime/model/index.ts"

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
  actions: {
    create: false,
    update: false,
    delete: false,
    batchDelete: false,
    setEnabled: {
      name: "Set module availability",
      description:
        "Enable a module and its dependencies, or disable it with explicitly confirmed dependent modules. Records are preserved.",
      scope: "collection",
      idempotent: true,
      input: {
        moduleId: schema.string(),
        enabled: schema.boolean(),
        disableDependents: schema.optional(schema.array(schema.string())),
      },
      output: { enabledModules: schema.array(schema.string()) },
      errors: [standardErrors.failedPrecondition],
    },
  },
  queries: {
    catalog: {
      name: "Browse modules",
      description:
        "Discover installed capabilities, their dependencies, and current availability.",
      scope: "collection",
      output: {
        modules: schema.array(
          schema.object({
            id: schema.string(),
            name: schema.string(),
            description: schema.string(),
            enabled: schema.boolean(),
            required: schema.boolean(),
            dependencies: schema.array(schema.string()),
            objects: schema.array(schema.string()),
          })
        ),
      },
    },
  },
  display: { title: "moduleId", icon: "settings" },
})
