import type { ObjectField } from "#/runtime/model/object-fields.ts"
import { linkPreview } from "#/runtime/model/record-links.ts"
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
  if (field.kind === "property" || field.kind === "resource")
    return record[field.id] ?? null
  if (field.kind === "link") return linkPreview(record.links?.[field.id]).ids
  const related = field.related
  const link = record.links?.[related.traversal.traversal.key]
  const { ids, totalSize } = linkPreview(link)
  if (related.count) return totalSize
  const values = ids.flatMap((id) => {
    const reference = resolveRecord?.(id)
    const target = reference?.record
    const mapping =
      reference?.object.interfaces[related.traversal.target.from.typeId]
        ?.propertyMapping ?? {}
    const value = target?.[mapping[related.key] ?? related.key]
    return value === null || value === undefined ? [] : [value]
  })
  if (related.traversal.traversal.max === 1) return values[0] ?? null
  return [
    ...values,
    ...(totalSize > ids.length ? [`+${totalSize - ids.length} more`] : []),
  ]
}
