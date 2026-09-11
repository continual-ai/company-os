import type {
  ClientRecord,
  ObjectRecordPresentation,
} from "#/runtime/ui/model/object-client.ts"
import type { RecordRelationship } from "#/runtime/ui/model/record-relationships.ts"

/** Counts and bounded IDs come from the record; hydration is shared with its other fields. */
export function useRecordRelationshipPreviews(
  relationships: ReadonlyArray<RecordRelationship>,
  record: ClientRecord | undefined,
  references: ReadonlyMap<string, ObjectRecordPresentation>
) {
  return relationships.map((relationship) => {
    const preview = record?.links?.[relationship.key]
    return {
      relationship,
      key: relationship.key,
      label: relationship.label,
      total: preview?.totalSize,
      pending: record === undefined,
      error: false,
      retry: () => {},
      items: (preview?.ids ?? []).flatMap((id) => {
        const value = references.get(id)
        return value?.source
          ? [{ object: value.object, record: value.source }]
          : []
      }),
    }
  })
}
