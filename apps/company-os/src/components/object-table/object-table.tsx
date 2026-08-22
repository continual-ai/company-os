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
import { useCallback, useMemo, useRef, useState } from "react"

import { ObjectTableCell as EditableObjectTableCell } from "./object-table-cell"
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
import { ObjectTableProperty } from "./object-table-property"
import {
  ObjectTableColumnMenu,
  ObjectTableToolbar,
} from "./object-table-toolbar"

interface ObjectTableProps {
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

interface CellAddress {
  columnId: string
  rowId: string
}

interface CellEditState extends CellAddress {
  initialValue?: string | undefined
}

function cellKey({ columnId, rowId }: CellAddress): string {
  return `${rowId}\u0000${columnId}`
}

function isSameCell(
  first: CellAddress | null,
  second: CellAddress | null
): boolean {
  return first?.columnId === second?.columnId && first?.rowId === second?.rowId
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
        size: 36,
        minSize: 36,
        maxSize: 36,
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
          sortFn: "alphanumeric",
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
            onCellCommit,
            property,
            propertyId,
          },
        })
      }),
    ])
  }, [object, onCellCommit, properties])

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
  const [activeCell, setActiveCell] = useState<CellAddress | null>(null)
  const [editingCell, setEditingCell] = useState<CellEditState | null>(null)
  const cellElements = useRef(new Map<string, HTMLTableCellElement>())
  const renderedTableWidth = table.getTotalSize() + 136

  const defaultActiveCell =
    visibleRows[0] === undefined || navigableColumns[0] === undefined
      ? null
      : {
          rowId: visibleRows[0].id,
          columnId: navigableColumns[0].id,
        }
  const resolvedActiveCell =
    activeCell !== null &&
    visibleRows.some((row) => row.id === activeCell.rowId) &&
    navigableColumns.some((column) => column.id === activeCell.columnId)
      ? activeCell
      : defaultActiveCell

  const focusCell = useCallback((address: CellAddress) => {
    window.requestAnimationFrame(() => {
      const element = cellElements.current.get(cellKey(address))
      element?.focus({ preventScroll: true })
      element?.scrollIntoView({ block: "nearest", inline: "nearest" })
    })
  }, [])

  const activateCell = useCallback(
    (address: CellAddress, focus = false) => {
      setEditingCell(null)
      setActiveCell(address)
      if (focus) focusCell(address)
    },
    [focusCell]
  )

  const setCellEditing = useCallback(
    (address: CellAddress, editing: boolean, initialValue?: string) => {
      setActiveCell(address)
      setEditingCell(editing ? { ...address, initialValue } : null)
      if (!editing) {
        window.requestAnimationFrame(() => {
          if (document.activeElement === document.body) focusCell(address)
        })
      }
    },
    [focusCell]
  )

  const moveCellFocus = useCallback(
    (rowIndex: number, columnIndex: number) => {
      const row = visibleRows[rowIndex]
      const column = navigableColumns[columnIndex]
      if (row === undefined || column === undefined) return
      activateCell({ rowId: row.id, columnId: column.id }, true)
    },
    [activateCell, navigableColumns, visibleRows]
  )

  const handleCellKeyDown = useCallback(
    (
      event: React.KeyboardEvent<HTMLTableCellElement>,
      rowIndex: number,
      columnIndex: number,
      editable: boolean,
      address: CellAddress
    ) => {
      if (editingCell !== null) return
      if (event.target !== event.currentTarget) return

      if (
        editable &&
        event.key.length === 1 &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        event.preventDefault()
        setCellEditing(address, true, event.key)
        return
      }

      const lastRow = visibleRows.length - 1
      const lastColumn = navigableColumns.length - 1
      let nextRow = rowIndex
      let nextColumn = columnIndex

      switch (event.key) {
        case "ArrowDown":
          nextRow = Math.min(rowIndex + 1, lastRow)
          break
        case "ArrowLeft":
          nextColumn = Math.max(columnIndex - 1, 0)
          break
        case "ArrowRight":
          nextColumn = Math.min(columnIndex + 1, lastColumn)
          break
        case "ArrowUp":
          nextRow = Math.max(rowIndex - 1, 0)
          break
        case "Home":
          nextColumn = 0
          if (event.ctrlKey || event.metaKey) nextRow = 0
          break
        case "End":
          nextColumn = lastColumn
          if (event.ctrlKey || event.metaKey) nextRow = lastRow
          break
        case "Tab": {
          const direction = event.shiftKey ? -1 : 1
          const flatIndex = rowIndex * navigableColumns.length + columnIndex
          const nextFlatIndex = flatIndex + direction
          if (
            nextFlatIndex < 0 ||
            nextFlatIndex >= visibleRows.length * navigableColumns.length
          ) {
            return
          }
          nextRow = Math.floor(nextFlatIndex / navigableColumns.length)
          nextColumn = nextFlatIndex % navigableColumns.length
          break
        }
        case "Enter":
        case "F2":
          if (editable) {
            event.preventDefault()
            setCellEditing(address, true)
          }
          return
        default:
          return
      }

      event.preventDefault()
      moveCellFocus(nextRow, nextColumn)
    },
    [
      editingCell,
      moveCellFocus,
      navigableColumns.length,
      setCellEditing,
      visibleRows.length,
    ]
  )

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
        aria-colcount={visibleColumns.length}
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
              <TableHead className="h-8 w-34 border-b bg-muted/20 p-0">
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
                  const active = isSameCell(resolvedActiveCell, address)
                  const editing = isSameCell(editingCell, address)
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
                      ref={(element) => {
                        const key = cellKey(address)
                        if (element === null) cellElements.current.delete(key)
                        else cellElements.current.set(key, element)
                      }}
                      aria-selected={active}
                      tabIndex={active ? 0 : -1}
                      className={cn(
                        "relative h-8 border-r p-0 outline-none",
                        active ? "z-30 overflow-visible" : "overflow-hidden"
                      )}
                      style={{ width: cell.column.getSize() }}
                      onClick={(event) => {
                        if (editing) return
                        if (event.detail > 1 && editable) {
                          event.preventDefault()
                          setCellEditing(address, true)
                          return
                        }
                        activateCell(address, true)
                      }}
                      onDoubleClick={(event) => {
                        if (!editable) return
                        event.preventDefault()
                        setCellEditing(address, true)
                      }}
                      onFocus={(event) => {
                        if (event.target === event.currentTarget) {
                          activateCell(address)
                        }
                      }}
                      onKeyDown={(event) =>
                        handleCellKeyDown(
                          event,
                          rowIndex,
                          columnIndex,
                          editable,
                          address
                        )
                      }
                    >
                      <EditableObjectTableCell
                        active={active}
                        editing={editing}
                        expandActive={expandActive}
                        initialEditValue={
                          editing ? editingCell?.initialValue : undefined
                        }
                        identity={
                          meta.propertyId === object.display.title
                            ? { object, record: row.original }
                            : undefined
                        }
                        property={meta.property}
                        resolveImageSrc={resolveImageSrc}
                        value={cellValue}
                        onEditingChange={(nextEditing) =>
                          setCellEditing(address, nextEditing)
                        }
                        onCommit={commitCell}
                      />
                    </TableCell>
                  )
                })}
                <TableCell className="h-8 border-r p-0" />
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
