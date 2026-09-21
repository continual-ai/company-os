import type { ObjectField } from "#/runtime/model/object-fields.ts"
import { EmptyFieldValue } from "#/runtime/ui/model/empty-field-value.tsx"
import { formatTotalSize } from "#/runtime/ui/model/format-total-size.ts"
import { objectFieldValue } from "#/runtime/ui/model/object-field-value.ts"
import { objectPropertyValue } from "#/runtime/ui/model/object-property-value.tsx"
import type {
  ObjectTableRecord,
  ObjectTableRecordResolver,
} from "#/runtime/ui/model/object-table/object-table-config.ts"
import { RecordLinkValue } from "#/runtime/ui/model/record-link-value.tsx"

/** Shared read presentation; layouts own placement and editing interactions. */
export function ObjectFieldValue({
  field,
  record,
  resolveRecord,
}: {
  field: ObjectField
  record: ObjectTableRecord
  resolveRecord?: ObjectTableRecordResolver | undefined
}) {
  const value = objectFieldValue(field, record, resolveRecord)
  switch (value.kind) {
    case "scalar":
      return objectPropertyValue(field.property, value.value, resolveRecord)
    case "link":
      return <RecordLinkValue value={value} resolveRecord={resolveRecord} />
    case "count":
      return <span className="tabular-nums">{formatTotalSize(value)}</span>
    default: {
      if (value.totalSize === 0 && value.totalSizeExact)
        return <EmptyFieldValue />
      return (
        <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
          {value.values.map((item, index) => (
            <span key={index}>
              {objectPropertyValue(field.property, item, resolveRecord)}
            </span>
          ))}
          {value.totalSize > value.loadedSize && (
            <span className="shrink-0 text-muted-foreground">
              +
              {formatTotalSize({
                totalSize: value.totalSize - value.loadedSize,
                totalSizeExact: value.totalSizeExact,
              })}{" "}
              more
            </span>
          )}
        </span>
      )
    }
  }
}
