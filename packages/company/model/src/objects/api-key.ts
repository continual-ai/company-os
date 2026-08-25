import { defineObject, schema, standardErrors } from "@company/runtime"

import { ServiceAccount } from "#objects/service-account"

const ApiKeyReference = { id: "apiKey" } as const

export const ApiKey = defineObject({
  id: "apiKey",
  collection: "apiKeys",
  name: "API key",
  parent: ServiceAccount,
  pluralName: "API keys",
  description:
    "A revocable credential that authenticates exactly one service account.",
  actions: {
    create: false,
    update: false,
    delete: false,
    batchDelete: false,
    issue: {
      name: "Issue API key",
      description: "Creates an API key and returns its secret exactly once.",
      scope: "collection",
      input: {
        expiresAt: schema.optional(schema.timestamp()),
        name: schema.string({ minLength: 1, maxLength: 200 }),
        serviceAccount: schema.recordId(ServiceAccount),
      },
      output: {
        apiKey: schema.recordId(ApiKeyReference),
        secret: schema.string({ minLength: 1 }),
      },
      errors: [standardErrors.permissionDenied],
    },
    revoke: {
      name: "Revoke API key",
      description: "Immediately prevents an API key from authenticating.",
      destructive: true,
      idempotent: true,
      scope: "object",
      errors: [standardErrors.notFound, standardErrors.permissionDenied],
    },
  },
  properties: {
    name: schema.string({ label: "Name", minLength: 1, maxLength: 200 }),
    prefix: schema.string({ label: "Prefix", minLength: 1, maxLength: 64 }),
    expiresAt: schema.timestamp({ label: "Expires at", nullable: true }),
    revokedAt: schema.timestamp({ label: "Revoked at", nullable: true }),
  },
  display: { icon: "keyRound", subtitle: "prefix", title: "name" },
})
