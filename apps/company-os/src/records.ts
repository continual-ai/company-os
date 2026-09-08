import { createRecordSearchContract } from "@company/runtime/client/record-search"

import { Model } from "#/app.model.ts"
const {
  searchableObjects,
  input: recordSearchInput,
  result: recordSearchResult,
} = createRecordSearchContract(Model)
export type RecordSearchInput = typeof recordSearchInput.Type
export type RecordSummary = (typeof recordSearchResult.Type.hits)[number]

export { searchableObjects }
