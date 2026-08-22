import { Button } from "@acme/ui/components/button"
import { Checkbox } from "@acme/ui/components/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@acme/ui/components/dropdown-menu"
import { Input } from "@acme/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@acme/ui/components/popover"
import type { ObjectType } from "@continual/runtime"
import {
  ArrowDownAZIcon,
  ArrowUpAZIcon,
  CheckIcon,
  Columns3Icon,
  PlusIcon,
  XIcon,
} from "lucide-react"
import { useMemo, useState } from "react"

import {
  objectTableColumnMeta,
  objectTablePropertyColumns,
} from "./object-table-columns"
import { type ObjectTableInstance } from "./object-table-config"
import { ObjectTableFilters } from "./object-table-filter"
import { ObjectTableProperty } from "./object-table-property"

interface ObjectTableToolbarProps {
  object: ObjectType
  onCreateRecord?: (() => Promise<void> | void) | undefined
  table: ObjectTableInstance
}

function ObjectTableSortMenu({ table }: { table: ObjectTableInstance }) {
  const sortedColumns = table.state.sorting.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2.5 text-muted-foreground"
          />
        }
      >
        <ArrowDownAZIcon />
        Sort
        {sortedColumns > 0 ? (
          <span className="text-foreground tabular-nums">{sortedColumns}</span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Sort by property</DropdownMenuLabel>
          {objectTablePropertyColumns(table).map((column) => {
            const meta = objectTableColumnMeta(column)
            const direction = column.getIsSorted()
            if (meta?.property === undefined) return null

            return (
              <DropdownMenuItem
                key={column.id}
                onClick={() => {
                  if (direction === "asc") column.toggleSorting(true, false)
                  else if (direction === "desc") column.clearSorting()
                  else column.toggleSorting(false, false)
                }}
              >
                <ObjectTableProperty
                  className="flex-1"
                  label={meta.label}
                  property={meta.property}
                />
                {direction === "asc" ? <ArrowDownAZIcon /> : null}
                {direction === "desc" ? <ArrowUpAZIcon /> : null}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
        {sortedColumns > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => table.resetSorting(true)}>
              <XIcon />
              Clear sorting
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ObjectTableColumnMenu({
  compact = false,
  table,
}: {
  compact?: boolean
  table: ObjectTableInstance
}) {
  const [query, setQuery] = useState("")
  const columns = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return objectTablePropertyColumns(table).filter((column) => {
      const meta = objectTableColumnMeta(column)
      return (
        normalizedQuery.length === 0 ||
        meta?.label.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [query, table])

  return (
    <Popover onOpenChange={(open) => !open && setQuery("")}>
      <PopoverTrigger
        render={
          <Button
            variant={compact ? "ghost" : "outline"}
            size="sm"
            className={
              compact
                ? "h-7 w-full justify-start text-muted-foreground"
                : undefined
            }
          />
        }
      >
        {compact ? <PlusIcon /> : <Columns3Icon />}
        {compact ? "Add column" : "Columns"}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-1.5 p-1.5">
        <Input
          aria-label="Search columns"
          placeholder="Search columns…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="max-h-64 overflow-y-auto py-0.5">
          {columns.map((column) => {
            const meta = objectTableColumnMeta(column)
            if (meta?.property === undefined) return null
            return (
              <Button
                key={column.id}
                type="button"
                variant="ghost"
                className="h-8 w-full justify-start px-2 font-normal"
                disabled={meta.essential}
                onClick={() => column.toggleVisibility()}
              >
                <Checkbox
                  aria-hidden="true"
                  checked={column.getIsVisible()}
                  tabIndex={-1}
                  className="pointer-events-none"
                />
                <ObjectTableProperty
                  className="flex-1 text-left"
                  label={meta.label}
                  property={meta.property}
                />
                {column.getIsVisible() ? <CheckIcon /> : null}
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function ObjectTableToolbar({
  object,
  onCreateRecord,
  table,
}: ObjectTableToolbarProps) {
  const selectedCount = table.getSelectedRowIds().length

  return (
    <>
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b px-5">
        <div className="flex h-7 min-w-0 items-center text-xs font-medium">
          {`All ${object.pluralName}`}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {selectedCount > 0 ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground tabular-nums">
                {selectedCount} selected
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => table.resetRowSelection(true)}
              >
                Clear
              </Button>
            </div>
          ) : null}
          {onCreateRecord === undefined ? null : (
            <Button
              type="button"
              size="sm"
              onClick={() => void onCreateRecord()}
            >
              <PlusIcon />
              New {object.name}
            </Button>
          )}
        </div>
      </div>
      <div className="flex h-10 shrink-0 items-center gap-1.5 border-b px-5">
        <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          <ObjectTableSortMenu table={table} />
          <ObjectTableFilters table={table} />
        </div>
        <div className="shrink-0">
          <ObjectTableColumnMenu table={table} />
        </div>
      </div>
    </>
  )
}
