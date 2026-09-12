import {
  defineObject,
  schema,
  standardErrors,
  defineAction,
} from "#/runtime/model/index.ts"

/** Durable file identity. Storage keys and bytes stay in the server adapter. */
export const Asset = defineObject({
  id: "asset",
  collection: "assets",
  name: "Asset",
  pluralName: "Assets",
  description: "A file or image attached to your work.",
  actions: { create: false, update: false },
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
  search: { fields: ["name"] },
  display: {
    icon: "file",
    title: "name",
    subtitle: "contentType",
    status: "state",
  },
})
export const BeginAssetUpload = defineAction({
  id: "beginUpload",
  collection: Asset,
  name: "Begin upload",
  description:
    "Start a private upload and get the URL for transferring the file.",
  idempotent: false,
  input: {
    name: schema.string({ minLength: 1, maxLength: 255 }),
    contentType: schema.string({ minLength: 1, maxLength: 120 }),
    size: schema.number({ integer: true, minimum: 1, maximum: 25_000_000 }),
  },
  output: {
    asset: schema.id({ id: "asset" }),
    uploadUrl: schema.string(),
  },
  errors: [standardErrors.failedPrecondition, standardErrors.notFound],
})
export const CompleteAssetUpload = defineAction({
  id: "completeUpload",
  object: Asset,
  name: "Complete upload",
  description:
    "Check the upload and make the file available. Uploaded files cannot be changed.",
  idempotent: true,
  output: { asset: schema.id({ id: "asset" }) },
  errors: [standardErrors.failedPrecondition, standardErrors.aborted],
  input: { id: schema.id(Asset) },
})
