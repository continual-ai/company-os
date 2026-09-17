import {
  defineLink,
  defineObject,
  RecordAlias,
  schema,
} from "#/runtime/model/index.ts"
import { ModuleSetting } from "#/runtime/platform/model/module-setting.ts"

export const Connector = defineObject({
  id: "connector",
  collection: "connectors",
  name: "Connector",
  pluralName: "Connectors",
  description:
    "A code-defined integration available to configured connections.",
  properties: {
    definitionId: schema.string({
      label: "Definition ID",
      immutable: true,
      outputOnly: true,
    }),
    name: schema.string({ outputOnly: true }),
    description: schema.string({ outputOnly: true }),
    authentication: schema.enumeration(["token"], {
      label: "Authentication",
      outputOnly: true,
    }),
    available: schema.boolean({ label: "Installed", outputOnly: true }),
  },
  uniqueBy: { definition: ["definitionId"] },
  actions: { create: false, update: false, delete: false, batchDelete: false },
  display: { title: "name", icon: "plug" },
})

export const ConnectorModule = defineLink({
  id: "connectorModule",
  name: "Connector module",
  outputOnly: true,
  from: { object: Connector, key: "module", label: "Module", min: 1, max: 1 },
  to: { object: ModuleSetting, key: "connectors", label: "Connectors" },
})

export const connectorAlias = (id: string) =>
  RecordAlias(`system:connector:${id}`)
