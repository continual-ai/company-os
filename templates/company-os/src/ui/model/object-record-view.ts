import { Schema } from "effect"

export interface ObjectRecordSearch {
  readonly tab?: string | undefined
}

const ObjectRecordSearchSchema = Schema.Struct({
  tab: Schema.optional(Schema.String),
})

export const validateObjectRecordSearch = Schema.decodeUnknownSync(
  ObjectRecordSearchSchema
)

export function objectRecordTabSearch(tab: string): ObjectRecordSearch {
  return tab === "overview" ? {} : { tab }
}
