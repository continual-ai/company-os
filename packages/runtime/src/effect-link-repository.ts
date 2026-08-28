import { Data, type Effect } from "effect"

import type { LinkDirection } from "./definition/model"
import type { ObjectRef } from "./definition/object"
import type { Page, PageToken } from "./definition/request"

export class LinkCardinalityConflict extends Data.TaggedError(
  "LinkCardinalityConflict"
)<{
  readonly linkId: string
  readonly sourceId: string
  readonly targetId: string
}> {}

export class InvalidLinkListRequest extends Data.TaggedError(
  "InvalidLinkListRequest"
)<{
  readonly linkId: string
  readonly message: string
}> {}

export interface LinkPair {
  readonly direction: LinkDirection
  readonly linkId: string
  readonly sourceId: string
  readonly targetId: string
}

export interface LinkList {
  readonly direction: LinkDirection
  readonly linkId: string
  readonly pageSize: number
  readonly pageToken?: PageToken
  readonly sourceId: string
}

export interface LinkListVisibility {
  readonly targets: ReadonlyArray<{
    readonly objectType: string
    readonly visibleWithin: ReadonlyArray<string>
  }>
}

/** Persistence contract for the edge set declared by model Links. */
export interface LinkRepository<TError = never, TRequirements = never> {
  /** Idempotently establishes one edge, replacing compatible singular edges. */
  readonly link: (
    pair: LinkPair
  ) => Effect.Effect<void, TError | LinkCardinalityConflict, TRequirements>
  readonly list: (
    request: LinkList,
    visibility?: LinkListVisibility
  ) => Effect.Effect<Page<ObjectRef>, TError, TRequirements>
  /** Idempotently removes one edge. */
  readonly unlink: (
    pair: LinkPair
  ) => Effect.Effect<void, TError, TRequirements>
}
