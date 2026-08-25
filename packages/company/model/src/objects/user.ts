import { defineObject, schema, standardErrors } from "@company/runtime"

import { Identity } from "#interfaces/identity"
import { Principal } from "#interfaces/principal"
import { Platform } from "#platform"

export const User = defineObject({
  id: "user",
  collection: "users",
  name: "User",
  parent: Platform,
  pluralName: "Users",
  description: "A person with authenticated access to this operating system.",
  actions: {
    create: false,
    delete: false,
    batchDelete: false,
    suspend: {
      name: "Suspend user",
      description:
        "Prevents a user from authenticating and revokes their active sessions.",
      destructive: true,
      idempotent: true,
      scope: "object",
      errors: [
        standardErrors.conflict,
        standardErrors.notFound,
        standardErrors.permissionDenied,
      ],
    },
    reactivate: {
      name: "Reactivate user",
      description: "Restores a suspended user's access.",
      idempotent: true,
      scope: "object",
      errors: [standardErrors.notFound, standardErrors.permissionDenied],
    },
  },
  implements: [{ interface: Identity }, { interface: Principal }],
  properties: {
    name: schema.string({ label: "Name", minLength: 1, maxLength: 200 }),
    email: schema.email({ label: "Email", maxLength: 320, immutable: true }),
    image: schema.image({ label: "Image", aspectRatio: 1, nullable: true }),
    status: schema.select({
      label: "Status",
      default: "active",
      immutable: true,
      options: [
        { value: "active", label: "Active", color: "green" },
        { value: "suspended", label: "Suspended", color: "gray" },
      ],
    }),
  },
  uniqueBy: { email: ["email"] },
  display: {
    icon: "person",
    image: "image",
    status: "status",
    subtitle: "email",
    title: "name",
  },
})
