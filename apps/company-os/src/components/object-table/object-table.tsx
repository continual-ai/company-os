import { Button } from "@acme/ui/components/button"
import { Checkbox } from "@acme/ui/components/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@acme/ui/components/table"
import { cn } from "@acme/ui/lib/utils"
import type { ObjectType } from "@continual/runtime"
import {
  createColumnHelper,
  type CellContext,
  type HeaderContext,
  useTable,
} from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon } from "lucide-react"
import { useMemo } from "react"

import { ObjectTableCell } from "./object-table-cell"
import { objectTableCellSelectionClassName } from "./object-table-cell-styles"
import {
  isObjectTableCellEditable,
  objectTableCellShouldExpand,
} from "./object-table-cell-types"
import {
  objectTableFeatures,
  objectTableValueText,
  type ObjectTableImageResolver,
  type ObjectTableRecord,
  type ObjectTableValue,
} from "./object-table-config"
import { useObjectTableNavigation } from "./object-table-navigation"
import { ObjectTableProperty } from "./object-table-property"
import {
  ObjectTableColumnMenu,
  ObjectTableToolbar,
} from "./object-table-toolbar"

export interface ObjectTableProps {
  object: ObjectType
  onCellCommit?:
    | ((
        recordId: string,
        propertyId: string,
        value: ObjectTableValue
      ) => Promise<void> | void)
    | undefined
  onCreateRecord?: (() => Promise<void> | void) | undefined
  records: ObjectTableRecord[]
  resolveImageSrc?: ObjectTableImageResolver | undefined
  visiblePropertyIds?: ReadonlyArray<string>
}

const columnHelper = createColumnHelper<
  typeof objectTableFeatures,
  ObjectTableRecord
>()

const selectionColumnWidth = 36
const addColumnWidth = 136

function SelectionHeader({
  table,
}: HeaderContext<typeof objectTableFeatures, ObjectTableRecord>) {
  return (
    <div className="flex size-full items-center justify-center">
      <Checkbox
        aria-label="Select all rows"
        checked={table.getIsAllRowsSelected()}
        indeterminate={
          !table.getIsAllRowsSelected() && table.getIsSomeRowsSelected()
        }
        onCheckedChange={(checked) => table.toggleAllRowsSelected(checked)}
      />
    </div>
  )
}

function SelectionCell({
  row,
}: CellContext<typeof objectTableFeatures, ObjectTableRecord>) {
  return (
    <div className="flex size-full items-center justify-center">
      <Checkbox
        aria-label={`Select row ${row.getDisplayIndex() + 1}`}
        checked={row.getIsSelected()}
        onCheckedChange={(checked) => row.toggleSelected(checked)}
      />
    </div>
  )
}

function propertyColumnSize(
  propertyId: string,
  propertyKind: string,
  titlePropertyId: string
): number {
  if (propertyId === titlePropertyId) return 240
  if (propertyKind === "enum") return 168
  if (propertyKind === "image") return 88
  return 200
}

export function ObjectTable({
  object,
  onCellCommit,
  onCreateRecord,
  records,
  resolveImageSrc,
  visiblePropertyIds,
}: ObjectTableProps) {
  const properties = useMemo(() => {
    const entries = Object.entries(object.properties)
    const titleEntry = entries.find(
      ([propertyId]) => propertyId === object.display.title
    )
    return titleEntry === undefined
      ? entries
      : [
          titleEntry,
          ...entries.filter(
            ([propertyId]) => propertyId !== object.display.title
          ),
        ]
  }, [object.display.title, object.properties])
  const columns = useMemo(() => {
    return columnHelper.columns([
      columnHelper.display({
        id: "select",
        enableHiding: false,
        enableResizing: false,
        enableSorting: false,
        size: selectionColumnWidth,
        minSize: selectionColumnWidth,
        maxSize: selectionColumnWidth,
        header: SelectionHeader,
        cell: SelectionCell,
        meta: { essential: true, label: "Select" },
      }),
      ...properties.map(([propertyId, property]) => {
        const isIdentity = propertyId === object.display.title
        const label = isIdentity ? object.name : (property.label ?? propertyId)

        return columnHelper.accessor((record) => record[propertyId], {
          id: propertyId,
          enableColumnFilter: true,
          enableHiding: propertyId !== object.display.title,
          enableResizing: true,
          enableSorting: true,
          filterFn: "objectProperty",
          sortFn: "objectProperty",
          sortUndefined: "last",
          size: propertyColumnSize(
            propertyId,
            property.kind,
            object.display.title
          ),
          minSize: propertyId === object.display.title ? 176 : 120,
          maxSize: 560,
          header: label,
          meta: {
            essential: isIdentity,
            label,
            property,
            propertyId,
          },
        })
      }),
    ])
  }, [object, properties])

  const initialState = useMemo(() => {
    const defaultPropertyIds = new Set(
      visiblePropertyIds ??
        [
          object.display.title,
          object.display.status,
          object.display.subtitle,
          ...properties.map(([propertyId]) => propertyId),
        ].filter((propertyId): propertyId is string => propertyId !== undefined)
    )

    return {
      columnVisibility: Object.fromEntries(
        properties.map(([propertyId]) => [
          propertyId,
          defaultPropertyIds.has(propertyId),
        ])
      ),
    }
  }, [object.display, properties, visiblePropertyIds])

  const table = useTable({
    features: objectTableFeatures,
    columns,
    data: records,
    getRowId: (record) => record.id,
    initialState,
    columnResizeMode: "onChange",
    enableMultiSort: true,
    enableSortingRemoval: true,
  })

  const visibleRows = table.getRowModel().rows
  const visibleColumns = table.getVisibleLeafColumns()
  const navigableColumns = visibleColumns.filter(
    (column) => column.columnDef.meta?.property !== undefined
  )
  const navigation = useObjectTableNavigation({
    columnIds: navigableColumns.map((column) => column.id),
    rowIds: visibleRows.map((row) => row.id),
  })
  const renderedTableWidth = table.getTotalSize() + addColumnWidth

  return (
    <section
      aria-label={`${object.pluralName} table`}
      className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-background"
    >
      <ObjectTableToolbar
        object={object}
        table={table}
        onCreateRecord={onCreateRecord}
      />

      <Table
        containerClassName="min-h-0 flex-1 overflow-auto"
        className="table-fixed border-separate border-spacing-0"
        role="grid"
        aria-colcount={visibleColumns.length + 1}
        aria-rowcount={visibleRows.length + 1}
        style={{ minWidth: "100%", width: renderedTableWidth }}
      >
        <TableHeader className="sticky top-0 z-20 bg-background [&_tr]:border-0">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => {
                const direction = header.column.getIsSorted()
                const meta = header.column.columnDef.meta
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      direction === "asc"
                        ? "ascending"
                        : direction === "desc"
                          ? "descending"
                          : "none"
                    }
                    className="relative h-8 border-r border-b bg-muted/20 p-0 text-xs"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : meta?.property ===
                      undefined ? (
                      <table.FlexRender header={header} />
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 w-full justify-start overflow-hidden px-2 font-medium hover:bg-muted"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <ObjectTableProperty
                          label={meta.label}
                          property={meta.property}
                        />
                        {direction === "asc" ? (
                          <ArrowDownIcon className="ml-auto" />
                        ) : null}
                        {direction === "desc" ? (
                          <ArrowUpIcon className="ml-auto" />
                        ) : null}
                      </Button>
                    )}
                    {header.column.getCanResize() ? (
                      <button
                        type="button"
                        aria-label={`Resize ${meta?.label ?? "column"}`}
                        className="absolute inset-y-0 -right-1 z-10 flex w-2 cursor-col-resize touch-none items-center justify-center opacity-0 hover:opacity-100 focus-visible:opacity-100"
                        onDoubleClick={() => header.column.resetSize()}
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                      >
                        <GripVerticalIcon className="size-3 text-muted-foreground" />
                      </button>
                    ) : null}
                  </TableHead>
                )
              })}
              <TableHead
                className="h-8 border-b bg-muted/20 p-0"
                style={{ width: addColumnWidth }}
              >
                <ObjectTableColumnMenu compact table={table} />
              </TableHead>
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {visibleRows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={visibleColumns.length + 1}
                className="h-40 text-center"
              >
                <p className="font-medium">
                  No matching {object.pluralName.toLowerCase()}
                </p>
                <p className="mt-1 text-muted-foreground">
                  Change or clear the current filters.
                </p>
              </TableCell>
            </TableRow>
          ) : (
            visibleRows.map((row, rowIndex) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className="h-8 hover:bg-muted/30"
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta
                  if (
                    meta?.property === undefined ||
                    meta.propertyId === undefined
                  ) {
                    return (
                      <TableCell
                        key={cell.id}
                        className="h-8 overflow-hidden border-r p-0"
                        style={{ width: cell.column.getSize() }}
                      >
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    )
                  }

                  const address = {
                    rowId: row.id,
                    columnId: cell.column.id,
                  }
                  const propertyId = meta.propertyId
                  const cellValue = row.original[propertyId] ?? null
                  const active = navigation.isActive(address)
                  const tabbable = navigation.isTabbable(address)
                  const editing = navigation.isEditing(address)
                  const expandActive =
                    active &&
                    !editing &&
                    objectTableCellShouldExpand(meta.property, {
                      displayLength: objectTableValueText(cellValue).length,
                      valueCount: Array.isArray(cellValue)
                        ? cellValue.length
                        : 0,
                    })
                  const columnIndex = navigableColumns.findIndex(
                    (column) => column.id === cell.column.id
                  )
                  const commitCell =
                    onCellCommit === undefined ||
                    !isObjectTableCellEditable(meta.property)
                      ? undefined
                      : (nextValue: ObjectTableValue) =>
                          onCellCommit(row.original.id, propertyId, nextValue)
                  const editable = commitCell !== undefined

                  return (
                    <TableCell
                      key={cell.id}
                      ref={(element) =>
                        navigation.registerCell(address, element)
                      }
                      data-object-table-cell=""
                      aria-selected={active}
                      tabIndex={tabbable ? 0 : -1}
                      className={cn(
                        "relative h-8 border-r p-0",
                        active
                          ? cn(
                              "z-30 overflow-visible",
                              objectTableCellSelectionClassName
                            )
                          : "overflow-hidden outline-none"
                      )}
                      style={{ width: cell.column.getSize() }}
                      onClick={(event) => {
                        if (editing) return
                        if (event.detail > 1 && editable) {
                          event.preventDefault()
                          navigation.setCellEditing(address, true)
                          return
                        }
                        navigation.activateCell(address, true)
                      }}
                      onDoubleClick={(event) => {
                        if (!editable) return
                        event.preventDefault()
                        navigation.setCellEditing(address, true)
                      }}
                      onFocus={(event) => {
                        if (event.target === event.currentTarget) {
                          navigation.activateCell(address)
                        }
                      }}
                      onKeyDown={(event) =>
                        navigation.handleCellKeyDown(
                          event,
                          rowIndex,
                          columnIndex,
                          editable,
                          address
                        )
                      }
                    >
                      <ObjectTableCell
                        active={active}
                        editing={editing}
                        expandActive={expandActive}
                        initialEditValue={
                          editing
                            ? navigation.editingCell?.initialValue
                            : undefined
                        }
                        identity={
                          meta.propertyId === object.display.title
                            ? { object, record: row.original }
                            : undefined
                        }
                        property={meta.property}
                        resolveImageSrc={resolveImageSrc}
                        value={cellValue}
                        onCancelEditing={() =>
                          navigation.cancelCellEditing(address)
                        }
                        onEditingChange={(nextEditing) =>
                          navigation.setCellEditing(address, nextEditing)
                        }
                        onCommit={commitCell}
                      />
                    </TableCell>
                  )
                })}
                <TableCell
                  className="h-8 border-r p-0"
                  style={{ width: addColumnWidth }}
                />
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <footer className="flex h-8 shrink-0 items-center border-t px-3 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {visibleRows.length === records.length
            ? `${records.length} ${records.length === 1 ? object.name.toLowerCase() : object.pluralName.toLowerCase()}`
            : `${visibleRows.length} of ${records.length} ${object.pluralName.toLowerCase()}`}
        </span>
        <span className="ml-auto hidden sm:inline">
          Arrows move · Type, Enter, or double-click to edit
        </span>
      </footer>
    </section>
  )
}
