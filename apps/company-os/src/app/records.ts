import { EnabledModel } from "#/app.model.ts"
import { createRecordSearchContract } from "#/runtime/client/record-search.ts"
const {
  searchableObjects,
  input: recordSearchInput,
  result: recordSearchResult,
} = createRecordSearchContract(EnabledModel)
export type RecordSearchInput = typeof recordSearchInput.Type
export type RecordSummary = (typeof recordSearchResult.Type.hits)[number]

export { searchableObjects }
