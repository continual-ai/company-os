import { defineObject, schema, standardErrors } from "@company/runtime"

import { AuthorizationScope } from "#modules/access/interfaces/authorization-scope"

/** Durable file identity. Storage keys and bytes stay in the server adapter. */
export const Asset = defineObject({
  id: "asset",
  collection: "assets",
  name: "Asset",
  pluralName: "Assets",
  parent: AuthorizationScope,
  actions: {
    create: false,
    update: false,
    beginUpload: {
      name: "Begin upload",
      description:
        "Reserve a private file in an authorized scope before transferring its bytes.",
      scope: "collection",
      idempotent: false,
      input: {
        scope: schema.reference(AuthorizationScope),
        name: schema.string({ minLength: 1, maxLength: 255 }),
        contentType: schema.string({ minLength: 1, maxLength: 120 }),
        size: schema.number({ integer: true, minimum: 1, maximum: 25_000_000 }),
      },
      output: {
        asset: schema.reference({ id: "asset" }),
        uploadUrl: schema.string(),
      },
      errors: [standardErrors.failedPrecondition, standardErrors.notFound],
    },
    completeUpload: {
      name: "Complete upload",
      description:
        "Verify stored bytes and make an immutable asset available for use.",
      scope: "object",
      idempotent: true,
      output: { asset: schema.reference({ id: "asset" }) },
      errors: [standardErrors.failedPrecondition, standardErrors.aborted],
    },
  },
  properties: {
    name: schema.string({ label: "Filename", minLength: 1, maxLength: 255 }),
    contentType: schema.string({ label: "Content type", maxLength: 120 }),
    size: schema.number({
      label: "Bytes",
      integer: true,
      minimum: 1,
      maximum: 25_000_000,
    }),
    state: schema.select({
      label: "State",
      default: "pending",
      options: [
        { value: "pending", label: "Awaiting upload" },
        { value: "ready", label: "Ready" },
      ],
    }),
    width: schema.number({ integer: true, minimum: 1, nullable: true }),
    height: schema.number({ integer: true, minimum: 1, nullable: true }),
    checksum: schema.string({ nullable: true, maxLength: 64 }),
  },
  display: {
    icon: "file",
    title: "name",
    subtitle: "contentType",
    status: "state",
  },
})
