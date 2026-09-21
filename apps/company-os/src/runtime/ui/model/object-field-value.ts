import type { ObjectField } from "#/runtime/model/object-fields.ts"
import { linkPreview } from "#/runtime/model/record-links.ts"
import { formatTotalSize } from "#/runtime/ui/model/format-total-size.ts"
import type {
  ObjectTableRecord,
  ObjectTableRecordResolver,
  ObjectTableValue,
} from "#/runtime/ui/model/object-table/object-table-config.ts"

/** Read canonical records; expansion and preview counts never become synthetic properties. */
export function objectFieldValue(
  field: ObjectField,
  record: ObjectTableRecord,
  resolveRecord?: ObjectTableRecordResolver
): ObjectTableValue {
  if (field.kind === "property" || field.kind === "record")
    return record[field.id] ?? null
  if (field.kind === "link") return linkPreview(record.links?.[field.id]).ids
  const related = field.related
  const link = record.links?.[related.traversal.traversal.key]
  const { ids, totalSize, totalSizeExact } = linkPreview(link)
  if (related.count) return totalSize
  const values = ids.flatMap((id) => {
    const reference = resolveRecord?.(id)
    const target = reference?.record
    const mapping =
      reference?.object.interfaces[related.traversal.inverse.from.typeId]
        ?.propertyMapping ?? {}
    const value = target?.[mapping[related.key] ?? related.key]
    return value === null || value === undefined ? [] : [value]
  })
  if (related.traversal.traversal.max === 1) return values[0] ?? null
  return [
    ...values,
    ...(totalSize > ids.length
      ? [
          `+${formatTotalSize({ totalSize: totalSize - ids.length, totalSizeExact })} more`,
        ]
      : []),
  ]
}
