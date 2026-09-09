import type { ListRequest } from "#/runtime/model/definition/request.ts"
import type { RecordIdentifier } from "#/runtime/model/definition/schema.ts"
/** Object-target Links support the same query as collections; interface targets support pagination only. */
export interface LinkListInput extends ListRequest {
  readonly id: RecordIdentifier
}

export interface LinkMutationInput {
  readonly id: RecordIdentifier
  readonly target: RecordIdentifier
}
