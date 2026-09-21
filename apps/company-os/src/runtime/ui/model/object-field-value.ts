import type { ObjectField } from "#/runtime/model/object-fields.ts"
import { linkPreview } from "#/runtime/model/record-links.ts"
import type {
  ObjectTableRecord,
  ObjectTableRecordResolver,
  ObjectTableValue,
} from "#/runtime/ui/model/object-table/object-table-config.ts"

type Count = { readonly totalSize: number; readonly totalSizeExact: boolean }
export type FieldValue =
  | { readonly kind: "scalar"; readonly value: ObjectTableValue }
  | ({ readonly kind: "link"; readonly ids: ReadonlyArray<string> } & Count)
  | ({ readonly kind: "count" } & Count)
  | ({
      readonly kind: "values"
      readonly values: ReadonlyArray<ObjectTableValue>
      readonly loadedSize: number
    } & Count)

/** Preserve preview metadata; presentation text never becomes a field value. */
export function objectFieldValue(
  field: ObjectField,
  record: ObjectTableRecord,
  resolveRecord?: ObjectTableRecordResolver
): FieldValue {
  if (field.kind === "property" || field.kind === "record")
    return { kind: "scalar", value: record[field.id] ?? null }
  if (field.kind === "link")
    return { kind: "link", ...linkPreview(record.links?.[field.id]) }
  const related = field.related
  const { ids, totalSize, totalSizeExact } = linkPreview(
    record.links?.[related.traversal.traversal.key]
  )
  if (related.count) return { kind: "count", totalSize, totalSizeExact }
  const values = ids.map((id) => {
    const reference = resolveRecord?.(id)
    const mapping =
      reference?.object.interfaces[related.traversal.inverse.from.typeId]
        ?.propertyMapping ?? {}
    return reference?.record[mapping[related.key] ?? related.key] ?? null
  })
  if (related.traversal.traversal.max === 1)
    return { kind: "scalar", value: values[0] ?? null }
  return {
    kind: "values",
    values,
    loadedSize: ids.length,
    totalSize,
    totalSizeExact,
  }
}
