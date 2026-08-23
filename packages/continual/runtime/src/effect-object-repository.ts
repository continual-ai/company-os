import { Data, type Effect } from "effect"

import type {
  ActorId,
  BaseRecord,
  Etag,
  ObjectCreateValues,
  ObjectRecord,
  ObjectType,
  ObjectUpdateValues,
} from "./definition/object"
import type {
  CanonicalListRequest,
  CanonicalObjectFilter,
  Page,
} from "./definition/request"
import type { RecordId } from "./definition/schema"

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

export class ObjectParentNotFound extends Data.TaggedError(
  "ObjectParentNotFound"
)<{
  readonly objectType: string
  readonly parentId: string
}> {}

export class ObjectParentTypeMismatch extends Data.TaggedError(
  "ObjectParentTypeMismatch"
)<{
  readonly actualParentObjectType: string
  readonly expectedParentObjectType: string
  readonly objectType: string
  readonly parentId: string
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

/** Values supplied by the object service for a newly inserted record. */
export type ObjectInsert<TObject extends ObjectType> = BaseRecord<
  TObject["id"],
  TObject["parent"]["objectType"]
> &
  Omit<ObjectCreateValues<TObject>, "parentId">

/** Metadata applied atomically with an object update. */
export interface ObjectUpdateMetadata {
  readonly etag: Etag
  readonly updatedAt: BaseRecord["updatedAt"]
  readonly updatedById: ActorId
}

/** Canonical values accepted by a repository update. */
export type ObjectRepositoryUpdate<TObject extends ObjectType> =
  ObjectUpdateValues<TObject>

/** Canonical query values accepted by a repository list. */
export type RepositoryListRequest<TObject extends ObjectType> =
  CanonicalListRequest<TObject>

/** Canonical query filter accepted by a repository list. */
export type RepositoryFilter<TObject extends ObjectType> =
  CanonicalObjectFilter<TObject>

/** Record version that must still exist when an atomic batch delete commits. */
export interface ObjectDeleteTarget<TObject extends ObjectType> {
  readonly expectedEtag: Etag
  readonly id: RecordId<TObject["id"]>
}

/**
 * Persistence contract consumed by the standard object service.
 *
 * Repositories receive values validated by a governed service and own storage
 * translation, concurrency, and atomicity. They do not authorize callers,
 * reimplement portable property validation, or implement business actions.
 */
export interface Repository<
  TObject extends ObjectType,
  TError = never,
  TRequirements = never,
> {
  /** Deletes every target atomically or leaves every target unchanged. */
  readonly batchDelete: (
    targets: ReadonlyArray<ObjectDeleteTarget<TObject>>
  ) => Effect.Effect<void, TError, TRequirements>
  readonly batchGet: (
    ids: ReadonlyArray<RecordId<TObject["id"]>>
  ) => Effect.Effect<
    ReadonlyArray<ObjectRecord<TObject>>,
    TError,
    TRequirements
  >
  readonly delete: (
    id: RecordId<TObject["id"]>,
    expectedEtag: Etag
  ) => Effect.Effect<void, TError, TRequirements>
  readonly get: (
    id: RecordId<TObject["id"]>
  ) => Effect.Effect<ObjectRecord<TObject>, TError, TRequirements>
  readonly insert: (
    record: ObjectInsert<TObject>
  ) => Effect.Effect<ObjectRecord<TObject>, TError, TRequirements>
  readonly list: (
    request?: RepositoryListRequest<TObject>
  ) => Effect.Effect<Page<ObjectRecord<TObject>>, TError, TRequirements>
  readonly update: (
    id: RecordId<TObject["id"]>,
    input: ObjectRepositoryUpdate<TObject>,
    expectedEtag: Etag,
    metadata: ObjectUpdateMetadata
  ) => Effect.Effect<ObjectRecord<TObject>, TError, TRequirements>
}
