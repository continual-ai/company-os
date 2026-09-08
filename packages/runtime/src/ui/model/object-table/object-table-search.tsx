import { CollectionSearch } from "#/ui/model/collection-search.tsx"
import {
  readFilterValue,
  type ObjectTableInstance,
} from "#/ui/model/object-table/object-table-config.ts"

export function ObjectTableSearch({
  table,
  property,
  label,
}: {
  table: ObjectTableInstance
  property: string
  label: string
}) {
  const column = table.getColumn(property)
  const filter = readFilterValue(column?.getFilterValue())
  const value = filter.operator === "contains" ? (filter.values[0] ?? "") : ""
  if (!column?.getCanFilter()) return null
  return (
    <CollectionSearch
      label={label}
      value={value}
      onChange={(next) =>
        column.setFilterValue(
          next ? { operator: "contains", values: [next] } : undefined
        )
      }
    />
  )
}
