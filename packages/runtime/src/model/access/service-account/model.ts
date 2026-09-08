import { Actor } from "#/model/access/interfaces/actor.ts"
import { Identity } from "#/model/access/interfaces/identity.ts"
import { Principal } from "#/model/access/interfaces/principal.ts"
import { Root } from "#/model/access/root.ts"
import { defineObject, schema } from "#/model/index.ts"

export const ServiceAccount = defineObject({
  id: "serviceAccount",
  collection: "serviceAccounts",
  name: "Service account",
  parent: Root,
  pluralName: "Service accounts",
  description: "An account for an integration, application, or agent.",
  actions: {
    create: false,
    delete: false,
    batchDelete: false,
    update: false,
  },
  implements: [
    { interface: Actor },
    { interface: Identity },
    { interface: Principal },
  ],
  properties: {
    name: schema.string({ label: "Name", minLength: 1, maxLength: 200 }),
    description: schema.string({
      label: "Description",
      maxLength: 2_000,
      nullable: true,
    }),
    status: schema.select({
      label: "Status",
      default: "active",
      immutable: true,
      options: [
        { value: "active", label: "Active", color: "green" },
        { value: "disabled", label: "Disabled", color: "gray" },
      ],
    }),
  },
  display: {
    icon: "bot",
    status: "status",
    subtitle: "description",
    title: "name",
  },
})
