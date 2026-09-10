import { Identity } from "#/runtime/access/model/interfaces/identity.ts"
import { defineObject, schema, Actor } from "#/runtime/model/index.ts"

export const ServiceAccount = defineObject({
  id: "serviceAccount",
  collection: "serviceAccounts",
  name: "Service account",
  pluralName: "Service accounts",
  description: "An account for an integration, application, or agent.",
  actions: {
    create: false,
    delete: false,
    batchDelete: false,
    update: false,
  },
  implements: [{ interface: Actor }, { interface: Identity }],
  properties: {
    name: schema.string({ label: "Name", minLength: 1, maxLength: 200 }),
    description: schema.string({
      label: "Description",
      maxLength: 2_000,
      nullable: true,
    }),
  },
  display: {
    icon: "bot",
    subtitle: "description",
    title: "name",
  },
})
