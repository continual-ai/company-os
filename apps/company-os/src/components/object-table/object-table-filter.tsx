import { Button } from "@acme/ui/components/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@acme/ui/components/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@acme/ui/components/dropdown-menu"
import { Input } from "@acme/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@acme/ui/components/popover"
import type { PropertyDefinition } from "@continual/runtime"
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FilterIcon,
  XIcon,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { objectTablePropertySchema } from "./object-table-cell-types"
import {
  objectTableColumnMeta,
  objectTablePropertyColumns,
  type ObjectTableColumn,
} from "./object-table-columns"
import {
  defaultFilterOperator,
  filterInputType,
  filterOperatorLabel,
  filterOperatorsForProperty,
  hasFilterInput,
  readFilterValue,
  type ObjectTableFilterValue,
  type ObjectTableInstance,
} from "./object-table-config"
import { ObjectTableProperty } from "./object-table-property"

interface FilterOption {
  label: string
  value: string
}

function filterOptions(
  property: PropertyDefinition
): ReadonlyArray<FilterOption> | null {
  const schema = objectTablePropertySchema(property)
  if (schema.kind === "enum") {
    return (
      schema.options ?? schema.values.map((value) => ({ label: value, value }))
    )
  }
  if (schema.kind === "boolean") {
    return [
      { label: "Yes", value: "true" },
      { label: "No", value: "false" },
    ]
  }
  return null
}

function optionCounts(
  table: ObjectTableInstance,
  columnId: string
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()
  for (const row of table.getCoreRowModel().rows) {
    const value = row.original[columnId]
    const values = Array.isArray(value) ? value : [value]
    for (const option of values) {
      if (option === null || option === "") continue
      const key = option.toString()
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return counts
}

function propertyLabel(column: ObjectTableColumn): string {
  return objectTableColumnMeta(column)?.label ?? column.id
}

function applyFilter(
  column: ObjectTableColumn,
  property: PropertyDefinition,
  values: ReadonlyArray<string>
) {
  column.setFilterValue({
    operator: defaultFilterOperator(property),
    values,
  } satisfies ObjectTableFilterValue)
}

function InitialFilterValue({
  column,
  onBack,
  onComplete,
  table,
}: {
  column: ObjectTableColumn
  onBack: () => void
  onComplete: () => void
  table: ObjectTableInstance
}) {
  const meta = objectTableColumnMeta(column)
  const property = meta?.property
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  if (property === undefined) return null
  const options = filterOptions(property)
  const counts = options === null ? null : optionCounts(table, column.id)

  const addScalarFilter = () => {
    const value = draft.trim()
    if (value.length === 0) return
    applyFilter(column, property, [value])
    onComplete()
  }

  return (
    <div className="min-w-0">
      <div className="flex h-8 items-center gap-1 border-b px-1">
        <Button type="button" variant="ghost" size="icon-xs" onClick={onBack}>
          <ChevronLeftIcon />
          <span className="sr-only">Back to properties</span>
        </Button>
        <ObjectTableProperty
          label={propertyLabel(column)}
          property={property}
          className="text-xs font-medium"
        />
      </div>

      {options === null ? (
        <form
          className="flex gap-1.5 p-1.5"
          onSubmit={(event) => {
            event.preventDefault()
            addScalarFilter()
          }}
        >
          <Input
            ref={inputRef}
            aria-label={`Filter ${propertyLabel(column)}`}
            type={filterInputType(property)}
            className="h-8 flex-1"
            placeholder="Enter value…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button type="submit" size="sm" disabled={draft.trim().length === 0}>
            Add
          </Button>
        </form>
      ) : (
        <Command>
          <CommandInput ref={inputRef} placeholder="Search values…" />
          <CommandList>
            <CommandEmpty>No matching values</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.value}`}
                  onSelect={() => {
                    applyFilter(column, property, [option.value])
                    onComplete()
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  <span className="ml-auto text-muted-foreground tabular-nums">
                    {counts?.get(option.value) ?? 0}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      )}
    </div>
  )
}

function ObjectTableFilterPicker({
  activeFilterCount,
  table,
}: {
  activeFilterCount: number
  table: ObjectTableInstance
}) {
  const [open, setOpen] = useState(false)
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null)
  const availableColumns = objectTablePropertyColumns(table, {
    includeReadonly: false,
  }).filter((column) => !column.getIsFiltered())
  const selectedColumn =
    selectedColumnId === null ? undefined : table.getColumn(selectedColumnId)

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setSelectedColumnId(null)
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size={activeFilterCount > 0 ? "icon-sm" : "sm"}
            className="text-muted-foreground"
            aria-label={activeFilterCount > 0 ? "Add filter" : undefined}
          />
        }
      >
        <FilterIcon />
        {activeFilterCount === 0 ? "Filter" : null}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-0 p-0">
        {selectedColumn === undefined ? (
          <Command>
            <CommandInput placeholder="Search properties…" />
            <CommandList>
              <CommandEmpty>No more matching properties</CommandEmpty>
              <CommandGroup>
                {availableColumns.map((column) => {
                  const meta = objectTableColumnMeta(column)
                  if (meta?.property === undefined) return null
                  return (
                    <CommandItem
                      key={column.id}
                      value={`${meta.label} ${column.id}`}
                      className="[&>svg:last-child]:hidden"
                      onSelect={() => setSelectedColumnId(column.id)}
                    >
                      <ObjectTableProperty
                        className="flex-1"
                        label={meta.label}
                        property={meta.property}
                      />
                      <ChevronRightIcon className="ml-auto text-muted-foreground" />
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <InitialFilterValue
            key={selectedColumn.id}
            column={selectedColumn}
            table={table}
            onBack={() => setSelectedColumnId(null)}
            onComplete={() => setOpen(false)}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}

function FilterOperator({
  column,
  filter,
}: {
  column: ObjectTableColumn
  filter: ObjectTableFilterValue
}) {
  const property = objectTableColumnMeta(column)?.property
  if (property === undefined) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-full rounded-none px-2 font-normal text-muted-foreground"
          />
        }
      >
        {filterOperatorLabel(filter.operator)}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Operator</DropdownMenuLabel>
          {filterOperatorsForProperty(property).map((operator) => (
            <DropdownMenuItem
              key={operator}
              onClick={() => {
                column.setFilterValue({
                  operator,
                  values: hasFilterInput(operator) ? filter.values : [],
                } satisfies ObjectTableFilterValue)
              }}
            >
              <span className="flex-1">{filterOperatorLabel(operator)}</span>
              {operator === filter.operator ? <CheckIcon /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function filterValueLabel(
  property: PropertyDefinition,
  values: ReadonlyArray<string>
): string {
  if (values.length === 0) return "Choose value"
  const options = filterOptions(property)
  const firstValue = values[0] ?? ""
  const firstLabel =
    options?.find((option) => option.value === firstValue)?.label ?? firstValue
  return values.length === 1
    ? firstLabel
    : `${firstLabel} +${values.length - 1}`
}

function ScalarFilterEditor({
  column,
  filter,
  property,
}: {
  column: ObjectTableColumn
  filter: ObjectTableFilterValue
  property: PropertyDefinition
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  return (
    <Input
      ref={inputRef}
      aria-label={`Filter ${propertyLabel(column)}`}
      type={filterInputType(property)}
      className="h-8"
      placeholder="Enter value…"
      value={filter.values[0] ?? ""}
      onChange={(event) => {
        column.setFilterValue({
          ...filter,
          values: [event.target.value],
        } satisfies ObjectTableFilterValue)
      }}
    />
  )
}

function OptionFilterEditor({
  column,
  filter,
  options,
  table,
}: {
  column: ObjectTableColumn
  filter: ObjectTableFilterValue
  options: ReadonlyArray<FilterOption>
  table: ObjectTableInstance
}) {
  const counts = useMemo(
    () => optionCounts(table, column.id),
    [column.id, table]
  )

  return (
    <Command>
      <CommandInput placeholder="Search values…" />
      <CommandList>
        <CommandEmpty>No matching values</CommandEmpty>
        <CommandGroup>
          {options.map((option) => {
            const selected = filter.values.includes(option.value)
            return (
              <CommandItem
                key={option.value}
                value={`${option.label} ${option.value}`}
                data-checked={selected}
                onSelect={() => {
                  column.setFilterValue({
                    ...filter,
                    values: selected
                      ? filter.values.filter((value) => value !== option.value)
                      : [...filter.values, option.value],
                  } satisfies ObjectTableFilterValue)
                }}
              >
                <span className="truncate">{option.label}</span>
                <span className="ml-auto text-muted-foreground tabular-nums">
                  {counts.get(option.value) ?? 0}
                </span>
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

function FilterValue({
  column,
  filter,
  table,
}: {
  column: ObjectTableColumn
  filter: ObjectTableFilterValue
  table: ObjectTableInstance
}) {
  const property = objectTableColumnMeta(column)?.property
  if (property === undefined || !hasFilterInput(filter.operator)) return null
  const options = filterOptions(property)

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-full max-w-48 rounded-none px-2 font-normal"
          />
        }
      >
        <span className="truncate">
          {filterValueLabel(property, filter.values)}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-0 p-1.5">
        {options === null ? (
          <ScalarFilterEditor
            column={column}
            filter={filter}
            property={property}
          />
        ) : (
          <OptionFilterEditor
            column={column}
            filter={filter}
            options={options}
            table={table}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}

function ObjectTableFilterItem({
  column,
  filter,
  table,
}: {
  column: ObjectTableColumn
  filter: ObjectTableFilterValue
  table: ObjectTableInstance
}) {
  const meta = objectTableColumnMeta(column)
  if (meta?.property === undefined) return null

  return (
    <div className="flex h-7 shrink-0 items-center divide-x border bg-background text-xs">
      <div className="flex h-full items-center px-2 font-medium">
        <ObjectTableProperty label={meta.label} property={meta.property} />
      </div>
      <FilterOperator column={column} filter={filter} />
      <FilterValue column={column} filter={filter} table={table} />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="h-full rounded-none"
        onClick={() => column.setFilterValue(undefined)}
      >
        <XIcon />
        <span className="sr-only">Remove {meta.label} filter</span>
      </Button>
    </div>
  )
}

export function ObjectTableFilters({ table }: { table: ObjectTableInstance }) {
  const filters = table.state.columnFilters

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <ObjectTableFilterPicker
        activeFilterCount={filters.length}
        table={table}
      />
      {filters.map((columnFilter) => {
        const column = table.getColumn(columnFilter.id)
        if (column === undefined) return null
        return (
          <ObjectTableFilterItem
            key={columnFilter.id}
            column={column}
            filter={readFilterValue(columnFilter.value)}
            table={table}
          />
        )
      })}
      {filters.length > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => table.resetColumnFilters(true)}
        >
          Clear
        </Button>
      ) : null}
    </div>
  )
}
