import { linkPreview } from "#/runtime/model/record-links.ts"
import type {
  ClientRecord,
  ObjectRecordPresentation,
} from "#/runtime/ui/model/object-client.ts"
import type { RecordLinkView } from "#/runtime/ui/model/record-link-views.ts"

/** Counts and bounded IDs come from the record; hydration is shared with its other fields. */
export function recordLinkPreviews(
  links: ReadonlyArray<RecordLinkView>,
  record: ClientRecord | undefined,
  references: ReadonlyMap<string, ObjectRecordPresentation>
) {
  return links.map((link) => {
    const preview = linkPreview(record?.links?.[link.key])
    return {
      link,
      key: link.key,
      label: link.label,
      totalSize: preview.totalSize,
      totalSizeExact: preview.totalSizeExact,
      pending: record === undefined,
      items: preview.ids.flatMap((id) => {
        const value = references.get(id)
        return value?.source
          ? [{ object: value.object, record: value.source }]
          : []
      }),
    }
  })
}
