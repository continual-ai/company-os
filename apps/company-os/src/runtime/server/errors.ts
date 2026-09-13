import { Data } from "effect"

export class ObjectNotFound extends Data.TaggedError("ObjectNotFound")<{
  readonly objectType: string
  readonly recordId: string
}> {}

export class ObjectWriteConflict extends Data.TaggedError(
  "ObjectWriteConflict"
)<{
  readonly objectType: string
  readonly recordId: string
}> {}

export class ObjectDeleteRestricted extends Data.TaggedError(
  "ObjectDeleteRestricted"
)<{
  readonly objectType: string
  readonly recordIds: ReadonlyArray<string>
}> {}

export class ObjectCheckFailed extends Data.TaggedError("ObjectCheckFailed")<{
  readonly objectType: string
  readonly fields: ReadonlyArray<string>
  readonly rule: string
  readonly message: string
}> {}

export class ObjectUniqueConflict extends Data.TaggedError(
  "ObjectUniqueConflict"
)<{
  readonly fields: ReadonlyArray<string>
  readonly objectType: string
  readonly rule: string
}> {}

export class InvalidListRequest extends Data.TaggedError("InvalidListRequest")<{
  readonly message: string
  readonly objectType: string
}> {}

export class RecordAliasConflict extends Data.TaggedError(
  "RecordAliasConflict"
)<{
  readonly alias: string
  readonly conflictingRecordId: string
  readonly recordId: string
}> {}

export class RecordAliasNotFound extends Data.TaggedError(
  "RecordAliasNotFound"
)<{
  readonly alias: string
}> {}

export class InvalidBatchRequest extends Data.TaggedError(
  "InvalidBatchRequest"
)<{
  readonly message: string
  readonly objectType: string
  readonly operation: "batchDelete" | "batchGet"
}> {}

export class ImmutablePropertyError extends Data.TaggedError(
  "ImmutablePropertyError"
)<{
  readonly property: string
  readonly objectType: string
  readonly recordId: string
}> {}

export class SystemRecordReadOnly extends Data.TaggedError(
  "SystemRecordReadOnly"
)<{
  readonly objectType: string
  readonly recordId: string
}> {}

export class LinkMutationNotAllowed extends Data.TaggedError(
  "LinkMutationNotAllowed"
)<{
  readonly linkId: string
  readonly traversal: string
}> {}

export class InvalidLinkRequest extends Data.TaggedError("InvalidLinkRequest")<{
  readonly message: string
  readonly path: ReadonlyArray<string>
}> {}

export class RequiredLinkMissing extends Data.TaggedError(
  "RequiredLinkMissing"
)<{
  readonly objectType: string
  readonly traversal: string
}> {}

export class LinkCardinalityConflict extends Data.TaggedError(
  "LinkCardinalityConflict"
)<{
  readonly linkId: string
  readonly sourceId: string
  readonly targetId: string
}> {}

export class InvalidExpansion extends Data.TaggedError("InvalidExpansion")<{
  readonly message: string
  readonly path: ReadonlyArray<string>
}> {}

export class CascadeDeleteRestricted extends Data.TaggedError(
  "CascadeDeleteRestricted"
)<{
  readonly recordId: string
}> {}

export class ProjectAccessRequired extends Data.TaggedError(
  "ProjectAccessRequired"
)<{}> {}

export class IdentityProvisioningRequired extends Data.TaggedError(
  "IdentityProvisioningRequired"
)<{ readonly reason: "email" }> {}

export class UserInterfaceRequired extends Data.TaggedError(
  "UserInterfaceRequired"
)<{}> {}

const runtimeErrorTypes = [
  ObjectNotFound,
  ObjectWriteConflict,
  ObjectDeleteRestricted,
  ObjectUniqueConflict,
  ObjectCheckFailed,
  InvalidListRequest,
  RecordAliasConflict,
  RecordAliasNotFound,
  InvalidBatchRequest,
  ImmutablePropertyError,
  SystemRecordReadOnly,
  LinkMutationNotAllowed,
  InvalidLinkRequest,
  RequiredLinkMissing,
  LinkCardinalityConflict,
  InvalidExpansion,
  CascadeDeleteRestricted,
  ProjectAccessRequired,
  IdentityProvisioningRequired,
  UserInterfaceRequired,
] as const
export type RuntimeError = InstanceType<(typeof runtimeErrorTypes)[number]>
export function isRuntimeError(error: unknown): error is RuntimeError {
  return runtimeErrorTypes.some((ErrorType) => error instanceof ErrorType)
}
