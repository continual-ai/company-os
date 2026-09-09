import type { RecordId } from "#/runtime/model/definition/schema.ts"
export type IdentityId = RecordId<"user"> | RecordId<"serviceAccount">
export type ActorId = IdentityId | RecordId<"anonymousActor">
export type PrincipalId =
  | IdentityId
  | RecordId<"principalSet">
  | RecordId<"group">
