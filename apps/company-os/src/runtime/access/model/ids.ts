import type { RecordId } from "#/runtime/model/definition/schema.ts"

/** Record ID of an authenticated Identity implementer. */
export type IdentityId = RecordId<"user"> | RecordId<"serviceAccount">
