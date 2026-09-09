import { Data, type Effect } from "effect"

import type {
  BaseRecord,
  Etag,
  ObjectCreateValues,
  ObjectParentRecordId,
  ObjectRecord,
  ObjectType,
  ObjectUpdateValues,
} from "#/runtime/model/definition/object.ts"
import type {
  CanonicalListRequest,
  CanonicalObjectFilter,
  Page,
} from "#/runtime/model/definition/request.ts"
import type { RecordId } from "#/runtime/model/definition/schema.ts"

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

export class ObjectUniqueConflict extends Data.TaggedError(
  "ObjectUniqueConflict"
)<{
  readonly fields: ReadonlyArray<string>
  readonly objectType: string
  readonly rule: string
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
  readonly expectedParentTypeId: string
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

/** Canonical insert values; persistence supplies the tag and timestamps. */
export type ObjectInsert<TObject extends ObjectType> = Omit<
  BaseRecord<TObject["id"], ObjectParentRecordId<TObject>>,
  "createdAt" | "etag" | "updatedAt"
> &
  Omit<ObjectCreateValues<TObject>, "parent">

/** Canonical update command accepted by persistence. */
export type ObjectRepositoryUpdate<TObject extends ObjectType> =
  ObjectUpdateValues<TObject> & {
    /** Record version that must still exist when the write commits. */
    readonly etag: Etag
    readonly id: RecordId<TObject["id"]>
    readonly updatedBy: ObjectRecord<TObject>["updatedBy"]
  }

/** Canonical query values accepted by a repository list. */
export type RepositoryListRequest<TObject extends ObjectType> =
  CanonicalListRequest<TObject> & {
    /** Internal edge constraint, established by the governed Link service. */
    readonly relatedTo?: {
      readonly linkId: string
      readonly direction: "forward" | "reverse"
      readonly sourceId: string
    }
  }

/** Canonical query filter accepted by a repository list. */
export type RepositoryFilter<TObject extends ObjectType> =
  CanonicalObjectFilter<TObject>

/** Internal hierarchy constraint supplied by governed services, never callers. */
export interface RepositoryListVisibility {
  readonly visibleWithin: ReadonlyArray<string>
}

/** Record version that must still exist when an atomic batch delete commits. */
export interface ObjectDeleteTarget<TObject extends ObjectType> {
  readonly etag: Etag
  readonly id: RecordId<TObject["id"]>
}

/**
 * Persistence contract consumed by the standard object service.
 *
 * Repositories receive values validated by a governed service and own storage
 * translation, record tags, storage timestamps, concurrency, and atomicity.
 * They do not authorize callers, reimplement portable property validation, or
 * implement business actions.
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
    target: ObjectDeleteTarget<TObject>
  ) => Effect.Effect<void, TError, TRequirements>
  readonly get: (
    id: RecordId<TObject["id"]>
  ) => Effect.Effect<ObjectRecord<TObject>, TError, TRequirements>
  readonly insert: (
    record: ObjectInsert<TObject>
  ) => Effect.Effect<ObjectRecord<TObject>, TError, TRequirements>
  readonly list: (
    request?: RepositoryListRequest<TObject>,
    visibility?: RepositoryListVisibility
  ) => Effect.Effect<Page<ObjectRecord<TObject>>, TError, TRequirements>
  readonly update: (
    command: ObjectRepositoryUpdate<TObject>
  ) => Effect.Effect<ObjectRecord<TObject>, TError, TRequirements>
  /** Idempotently converges one complete, stable-ID record for trusted seeds. */
  readonly upsert: (
    record: ObjectInsert<TObject>
  ) => Effect.Effect<ObjectRecord<TObject>, TError, TRequirements>
}
