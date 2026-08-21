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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@acme/ui/components/select"
import type { ObjectType, PropertyDefinition } from "@continual/runtime"
import {
  ArrowDownAZIcon,
  ArrowUpAZIcon,
  CheckIcon,
  Columns3Icon,
  FilterIcon,
  ListFilterIcon,
  PlusIcon,
  XIcon,
} from "lucide-react"
import { useMemo, useState } from "react"

import {
  defaultFilterOperator,
  filterOperatorLabel,
  filterOperatorsForProperty,
  hasFilterInput,
  readFilterValue,
  type ObjectTableColumnMeta,
  type ObjectTableFilterValue,
  type ObjectTableInstance,
} from "./object-table-config"
import { ObjectTablePropertyIcon } from "./object-table-property"

interface ObjectTableToolbarProps {
  object: ObjectType
  onCreateRecord?: (() => Promise<void> | void) | undefined
  table: ObjectTableInstance
}

function columnMeta(column: {
  columnDef: { meta?: ObjectTableColumnMeta }
}): ObjectTableColumnMeta | undefined {
  return column.columnDef.meta
}

function propertyColumns(table: ObjectTableInstance) {
  return table
    .getAllLeafColumns()
    .filter((column) => columnMeta(column)?.property !== undefined)
}

function ObjectTableSortMenu({ table }: { table: ObjectTableInstance }) {
  const sortedColumns = table.state.sorting.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="text-muted-foreground" />
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
          {propertyColumns(table).map((column) => {
            const meta = columnMeta(column)
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
                <ObjectTablePropertyIcon property={meta.property} />
                <span className="flex-1 truncate">{meta.label}</span>
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

function ObjectTableFilterPicker({ table }: { table: ObjectTableInstance }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const availableColumns = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return propertyColumns(table).filter((column) => {
      const meta = columnMeta(column)
      return (
        !column.getIsFiltered() &&
        (normalizedQuery.length === 0 ||
          meta?.label.toLowerCase().includes(normalizedQuery))
      )
    })
  }, [query, table])

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setQuery("")
      }}
    >
      <PopoverTrigger
        render={
          <Button variant="ghost" size="sm" className="text-muted-foreground" />
        }
      >
        <FilterIcon />
        Filter
        {table.state.columnFilters.length > 0 ? (
          <span className="text-foreground tabular-nums">
            {table.state.columnFilters.length}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-1.5 p-1.5">
        <Input
          aria-label="Search properties"
          placeholder="Search properties…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="max-h-64 overflow-y-auto py-0.5">
          {availableColumns.map((column) => {
            const meta = columnMeta(column)
            if (meta?.property === undefined) return null
            const property = meta.property
            return (
              <Button
                key={column.id}
                type="button"
                variant="ghost"
                className="h-8 w-full justify-start px-2 font-normal"
                onClick={() => {
                  column.setFilterValue({
                    operator: defaultFilterOperator(property),
                    value: "",
                  } satisfies ObjectTableFilterValue)
                  setOpen(false)
                }}
              >
                <ObjectTablePropertyIcon property={property} />
                <span className="truncate">{meta.label}</span>
              </Button>
            )
          })}
          {availableColumns.length === 0 ? (
            <p className="px-2 py-5 text-center text-xs text-muted-foreground">
              No more matching properties
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function FilterInput({
  filter,
  onChange,
  property,
}: {
  filter: ObjectTableFilterValue
  onChange: (filter: ObjectTableFilterValue) => void
  property: PropertyDefinition
}) {
  if (!hasFilterInput(filter.operator)) return null

  if (property.kind === "enum") {
    const choices =
      property.options ??
      property.values.map((option) => ({ label: option, value: option }))
    return (
      <Select
        value={filter.value || null}
        onValueChange={(value) => {
          if (value !== null) onChange({ ...filter, value })
        }}
      >
        <SelectTrigger
          size="sm"
          className="h-7 min-w-28 border-0 border-l px-2 shadow-none focus-visible:ring-0"
        >
          <SelectValue placeholder="Choose value…" />
        </SelectTrigger>
        <SelectContent align="start">
          {choices.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <Input
      aria-label="Filter value"
      className="h-7 min-w-28 border-0 border-l px-2 focus-visible:ring-0"
      placeholder="Enter value…"
      value={filter.value}
      onChange={(event) => onChange({ ...filter, value: event.target.value })}
    />
  )
}

function ObjectTableFilterBar({ table }: { table: ObjectTableInstance }) {
  if (table.state.columnFilters.length === 0) return null

  return (
    <div className="flex min-h-9 shrink-0 items-center gap-1.5 overflow-x-auto border-b px-3 py-1">
      <span className="mr-0.5 flex items-center gap-1 text-xs text-muted-foreground">
        <ListFilterIcon className="size-3.5" />
        Where
      </span>
      {table.state.columnFilters.map((columnFilter) => {
        const column = table.getColumn(columnFilter.id)
        const meta = column === undefined ? undefined : columnMeta(column)
        if (column === undefined || meta?.property === undefined) return null
        const filter = readFilterValue(columnFilter.value)
        const operators = filterOperatorsForProperty(meta.property)

        return (
          <div
            key={columnFilter.id}
            className="flex h-7 shrink-0 items-center border bg-background"
          >
            <span className="flex items-center gap-1.5 px-2 font-medium">
              <ObjectTablePropertyIcon property={meta.property} />
              {meta.label}
            </span>
            <Select
              value={filter.operator}
              onValueChange={(operator) => {
                if (operator !== null) {
                  column.setFilterValue({ ...filter, operator })
                }
              }}
            >
              <SelectTrigger
                size="sm"
                className="h-7 border-0 border-l px-2 shadow-none focus-visible:ring-0"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {operators.map((operator) => (
                  <SelectItem key={operator} value={operator}>
                    {filterOperatorLabel(operator)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FilterInput
              filter={filter}
              property={meta.property}
              onChange={(nextFilter) => column.setFilterValue(nextFilter)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="mx-0.5"
              onClick={() => column.setFilterValue(undefined)}
            >
              <XIcon />
              <span className="sr-only">Remove {meta.label} filter</span>
            </Button>
          </div>
        )
      })}
      <ObjectTableFilterPicker table={table} />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => table.resetColumnFilters(true)}
      >
        Clear
      </Button>
    </div>
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
    return propertyColumns(table).filter((column) => {
      const meta = columnMeta(column)
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
            const meta = columnMeta(column)
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
                <ObjectTablePropertyIcon property={meta.property} />
                <span className="flex-1 truncate text-left">{meta.label}</span>
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
      <div className="flex min-h-11 shrink-0 items-center justify-between gap-3 border-b px-3">
        <div className="flex min-w-0 items-center gap-1">
          <div className="flex h-7 items-center px-2 text-xs font-medium">
            {`All ${object.pluralName}`}
          </div>
          <ObjectTableSortMenu table={table} />
          <ObjectTableFilterPicker table={table} />
          <ObjectTableColumnMenu table={table} />
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
      <ObjectTableFilterBar table={table} />
    </>
  )
}
