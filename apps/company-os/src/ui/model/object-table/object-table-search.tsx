import { Input } from "@company/ui/components/input"
import { SearchIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import {
  readFilterValue,
  type ObjectTableInstance,
} from "./object-table-config"

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
  const [draft, setDraft] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    setDraft(value)
  }, [value])
  useEffect(
    () => () => {
      if (timer.current !== undefined) clearTimeout(timer.current)
    },
    []
  )
  if (!column?.getCanFilter()) return null
  return (
    <div className="relative w-full sm:ml-auto sm:w-56 sm:shrink-0">
      <SearchIcon className="pointer-events-none absolute top-1.5 left-2 size-3.5 text-muted-foreground" />
      <Input
        type="search"
        aria-label={`Search ${label}`}
        placeholder={`Search ${label.toLowerCase()}…`}
        value={draft}
        className="h-7 pl-7"
        onChange={(event) => {
          const next = event.target.value
          setDraft(next)
          if (timer.current !== undefined) clearTimeout(timer.current)
          timer.current = setTimeout(
            () =>
              column.setFilterValue(
                next ? { operator: "contains", values: [next] } : undefined
              ),
            200
          )
        }}
      />
    </div>
  )
}
