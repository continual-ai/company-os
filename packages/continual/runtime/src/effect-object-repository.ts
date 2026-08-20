import { Data, type Effect } from "effect"

import type {
  ActorId,
  BaseRecord,
  Etag,
  ObjectCreateInput,
  ObjectRecord,
  ObjectType,
  ObjectUpdateInput,
} from "./definition/object"
import type { ListRequest, Page } from "./definition/request"
import type { RecordId } from "./definition/schema"

export class ObjectNotFound extends Data.TaggedError("ObjectNotFound")<{
  readonly objectId: string
  readonly recordId: string
}> {}

export class ObjectWriteConflict extends Data.TaggedError(
  "ObjectWriteConflict"
)<{
  readonly objectId: string
  readonly recordId: string
}> {}

export class ObjectParentNotFound extends Data.TaggedError(
  "ObjectParentNotFound"
)<{
  readonly objectId: string
  readonly parentId: string
}> {}

export class ObjectParentTypeMismatch extends Data.TaggedError(
  "ObjectParentTypeMismatch"
)<{
  readonly actualParentObjectId: string
  readonly expectedParentObjectId: string
  readonly objectId: string
  readonly parentId: string
}> {}

/** Values supplied by the object service for a newly inserted record. */
export type ObjectInsert<TObject extends ObjectType> = BaseRecord<
  TObject["id"],
  TObject["parent"]["objectId"]
> &
  Omit<ObjectCreateInput<TObject>, "parentId">

/** Metadata applied atomically with an object update. */
export interface ObjectUpdateMetadata {
  readonly etag: Etag
  readonly updatedAt: BaseRecord["updatedAt"]
  readonly updatedById: ActorId
}

/**
 * Persistence contract consumed by the standard object service.
 *
 * Repositories know storage and atomicity. They do not authorize callers or
 * implement business actions.
 */
export interface Repository<
  TObject extends ObjectType,
  TError = never,
  TRequirements = never,
> {
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
    request?: ListRequest
  ) => Effect.Effect<Page<ObjectRecord<TObject>>, TError, TRequirements>
  readonly update: (
    id: RecordId<TObject["id"]>,
    input: ObjectUpdateInput<TObject>,
    expectedEtag: Etag,
    metadata: ObjectUpdateMetadata
  ) => Effect.Effect<ObjectRecord<TObject>, TError, TRequirements>
}
