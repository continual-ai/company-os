import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@company/ui/alert-dialog"
import { Button } from "@company/ui/button"
import { Checkbox } from "@company/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@company/ui/dropdown-menu"
import { Input } from "@company/ui/input"
import { PageToolbar } from "@company/ui/page"
import { Popover, PopoverContent, PopoverTrigger } from "@company/ui/popover"
import {
  ArrowDownAZIcon,
  ArrowUpAZIcon,
  CheckIcon,
  Columns3Icon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { useMemo, useState } from "react"
import type { ReactNode } from "react"

import {
  MAX_BATCH_DELETE_SIZE,
  type ObjectType,
} from "#/runtime/model/index.ts"
import {
  objectTableColumnMeta,
  objectTablePropertyColumns,
} from "#/runtime/ui/model/object-table/object-table-columns.ts"
import { type ObjectTableInstance } from "#/runtime/ui/model/object-table/object-table-config.ts"
import { ObjectTableFilters } from "#/runtime/ui/model/object-table/object-table-filter.tsx"
import { ObjectTableProperty } from "#/runtime/ui/model/object-table/object-table-property.tsx"
import { ObjectTableSearch } from "#/runtime/ui/model/object-table/object-table-search.tsx"

interface ObjectTableToolbarProps {
  canDeleteRecord?: ((recordId: string) => boolean) | undefined
  renderSelectedRecordActions?: ((recordId: string) => ReactNode) | undefined
  object: ObjectType
  onCreateRecord?: (() => Promise<void> | void) | undefined
  onDeleteRecords?:
    | ((recordIds: ReadonlyArray<string>) => Promise<void> | void)
    | undefined
  table: ObjectTableInstance
  tableTitle?: ReactNode
  toolbarActions?: ReactNode
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
            if (meta?.property === undefined || !column.getCanSort())
              return null

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
  canDeleteRecord,
  renderSelectedRecordActions,
  object,
  onCreateRecord,
  onDeleteRecords,
  table,
  tableTitle,
  toolbarActions,
}: ObjectTableToolbarProps) {
  const selectedIds = table.getSelectedRowIds()
  const selectedCount = selectedIds.length
  const canDeleteSelected = selectedIds.every(
    (id) => canDeleteRecord?.(id) ?? true
  )
  const canFilter = table
    .getAllLeafColumns()
    .some((column) => column.getCanFilter())
  const canSort = table
    .getAllLeafColumns()
    .some((column) => column.getCanSort())
  const hasQueryControls = canSort || canFilter
  const [deleteError, setDeleteError] = useState<string>()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePending, setDeletePending] = useState(false)

  return (
    <>
      <PageToolbar className="justify-between">
        {tableTitle !== null && (
          <div className="flex min-w-0 items-center text-xs font-medium">
            {tableTitle ?? `All ${object.pluralName}`}
          </div>
        )}
        <div className="ml-auto flex max-w-full flex-wrap items-center gap-2">
          {!hasQueryControls && <ObjectTableColumnMenu table={table} />}
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
              {selectedCount === 1 &&
                renderSelectedRecordActions?.(selectedIds[0]!)}
              {onDeleteRecords === undefined || !canDeleteSelected ? null : (
                <AlertDialog
                  open={deleteOpen}
                  onOpenChange={(open) => {
                    setDeleteOpen(open)
                    if (!open) setDeleteError(undefined)
                  }}
                >
                  <AlertDialogTrigger
                    render={
                      <Button type="button" variant="destructive" size="sm" />
                    }
                  >
                    <Trash2Icon />
                    Delete
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Delete {selectedCount}{" "}
                        {selectedCount === 1
                          ? object.name.toLowerCase()
                          : object.pluralName.toLowerCase()}
                        ?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {selectedCount > MAX_BATCH_DELETE_SIZE
                          ? `Select at most ${MAX_BATCH_DELETE_SIZE} records to delete at a time.`
                          : "This removes the selected records and cannot be undone."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    {deleteError === undefined ? null : (
                      <p role="alert" className="text-xs text-destructive">
                        {deleteError}
                      </p>
                    )}
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={deletePending}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        disabled={
                          deletePending || selectedCount > MAX_BATCH_DELETE_SIZE
                        }
                        onClick={() => {
                          setDeletePending(true)
                          setDeleteError(undefined)
                          void Promise.resolve(
                            onDeleteRecords(table.getSelectedRowIds())
                          )
                            .then(() => {
                              table.resetRowSelection(true)
                              setDeleteOpen(false)
                            })
                            .catch((cause: unknown) =>
                              setDeleteError(
                                cause instanceof Error
                                  ? cause.message
                                  : "The records could not be deleted."
                              )
                            )
                            .finally(() => setDeletePending(false))
                        }}
                      >
                        {deletePending ? "Deleting…" : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          ) : null}
          {onCreateRecord === undefined ? null : (
            <Button
              type="button"
              size="default"
              onClick={() => void onCreateRecord()}
            >
              <PlusIcon />
              New {object.name.toLowerCase()}
            </Button>
          )}
          {toolbarActions}
        </div>
      </PageToolbar>
      {hasQueryControls && (
        <ObjectTableQueryToolbar object={object} table={table}>
          <ObjectTableColumnMenu table={table} />
        </ObjectTableQueryToolbar>
      )}
    </>
  )
}

export function ObjectTableQueryToolbar({
  object,
  table,
  children,
}: {
  object: ObjectType
  table: ObjectTableInstance
  children?: ReactNode
}) {
  const columns = table.getAllLeafColumns()
  const canSort = columns.some((column) => column.getCanSort())
  const canFilter = columns.some((column) => column.getCanFilter())
  if (!canSort && !canFilter) return null
  return (
    <PageToolbar>
      <div className="no-scrollbar flex min-w-0 flex-1 basis-full items-center gap-1.5 overflow-x-auto sm:basis-auto">
        {canSort ? <ObjectTableSortMenu table={table} /> : null}
        {canFilter ? <ObjectTableFilters table={table} /> : null}
      </div>
      <ObjectTableSearch
        table={table}
        property={object.display.title}
        label={object.pluralName}
      />
      {children ? <div className="shrink-0">{children}</div> : null}
    </PageToolbar>
  )
}
