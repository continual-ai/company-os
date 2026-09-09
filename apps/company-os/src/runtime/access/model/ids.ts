import type { RecordId } from "#/runtime/model/definition/schema.ts"

/** Record ID of an authenticated Identity implementer. */
export type IdentityId = RecordId<"user"> | RecordId<"serviceAccount">

/** Record ID of a Principal implementer that can be granted access. */
export type PrincipalId =
  | IdentityId
  | RecordId<"principalSet">
  | RecordId<"group">
