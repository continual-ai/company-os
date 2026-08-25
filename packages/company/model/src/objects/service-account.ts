import { defineObject, schema, standardErrors } from "@company/runtime"

import { Identity } from "#interfaces/identity"
import { Principal } from "#interfaces/principal"
import { Platform } from "#platform"

export const ServiceAccount = defineObject({
  id: "serviceAccount",
  collection: "serviceAccounts",
  name: "Service account",
  parent: Platform,
  pluralName: "Service accounts",
  description: "An identity used by software, integrations, and agents.",
  actions: {
    delete: false,
    batchDelete: false,
    disable: {
      name: "Disable service account",
      description:
        "Immediately prevents every API key for this service account from authenticating.",
      destructive: true,
      idempotent: true,
      scope: "object",
      errors: [standardErrors.notFound, standardErrors.permissionDenied],
    },
    enable: {
      name: "Enable service account",
      description: "Restores API key authentication for a service account.",
      idempotent: true,
      scope: "object",
      errors: [standardErrors.notFound, standardErrors.permissionDenied],
    },
  },
  implements: [{ interface: Identity }, { interface: Principal }],
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
