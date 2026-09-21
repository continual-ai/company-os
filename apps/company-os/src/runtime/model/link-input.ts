import type { ListRequest } from "#/runtime/model/definition/request.ts"
import type { RecordIdentifier } from "#/runtime/model/definition/schema.ts"
/** Links support the target Object or Interface shared fields and the standard list contract. */
export interface LinkListInput extends ListRequest {
  readonly id: RecordIdentifier
}

export interface LinkMutationInput {
  readonly etag?: string
  readonly id: RecordIdentifier
  readonly target: RecordIdentifier
}
