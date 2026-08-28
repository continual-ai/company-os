/* oxlint-disable anti-slop/no-conditional-empty-object-spread */
import {
  schema,
  type ObjectType,
  type PropertyDefinition,
} from "@company/runtime"
import { Button } from "@company/ui/components/button"
import { Checkbox } from "@company/ui/components/checkbox"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@company/ui/components/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@company/ui/components/table"
import { cn } from "@company/ui/lib/utils"
import {
  createColumnHelper,
  type ColumnFiltersState,
  type CellContext,
  type HeaderContext,
  type OnChangeFn,
  type SortingState,
  useTable,
} from "@tanstack/react-table"
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GripVerticalIcon,
} from "lucide-react"
import { type CSSProperties, useMemo, useState } from "react"
import type { ReactNode } from "react"

import { ObjectTableCell } from "./object-table-cell"
import {
  objectTableCellSelectionClassName,
  objectTablePinnedCellClassName,
} from "./object-table-cell-styles"
import {
  isObjectTableCellEditable,
  objectTableCellShouldExpand,
} from "./object-table-cell-types"
import type { ObjectTableColumn } from "./object-table-columns"
import {
  objectTableFeatures,
  objectTableValueText,
  type ObjectTableImageResolver,
  type ObjectTableRecordLabelResolver,
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
  canDeleteRecord?: ((recordId: string) => boolean) | undefined
  canFilterProperty?: ((property: PropertyDefinition) => boolean) | undefined
  canSortProperty?: ((property: PropertyDefinition) => boolean) | undefined
  canUpdateRecord?: ((recordId: string) => boolean) | undefined
  columnFilters?: ColumnFiltersState | undefined
  columnVisibility?: Readonly<Record<string, boolean>> | undefined
  object: ObjectType
  onCellCommit?:
    | ((
        recordId: string,
        propertyId: string,
        value: ObjectTableValue
      ) => Promise<void> | void)
    | undefined
  onCreateRecord?: (() => Promise<void> | void) | undefined
  onDeleteRecords?:
    | ((recordIds: ReadonlyArray<string>) => Promise<void> | void)
    | undefined
  records: ObjectTableRecord[]
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState> | undefined
  onColumnVisibilityChange?: OnChangeFn<Record<string, boolean>> | undefined
  onSortingChange?: OnChangeFn<SortingState> | undefined
  pagination?:
    | {
        readonly hasNextPage: boolean
        readonly hasPreviousPage: boolean
        readonly loading: boolean
        readonly onNextPage: () => void
        readonly onPreviousPage: () => void
        readonly totalSize: number
      }
    | undefined
  parentLabel?: string | undefined
  recordHref?: ((recordId: string) => string) | undefined
  renderRecordActions?: ((record: ObjectTableRecord) => ReactNode) | undefined
  toolbarActions?: ReactNode
  resolveImageSrc?: ObjectTableImageResolver | undefined
  resolveRecordLabel?: ObjectTableRecordLabelResolver | undefined
  sorting?: SortingState | undefined
  tableTitle?: ReactNode
  visiblePropertyIds?: ReadonlyArray<string>
}

const columnHelper = createColumnHelper<
  typeof objectTableFeatures,
  ObjectTableRecord
>()

const selectionControlWidth = 36
const titleColumnWidth = 276
const addColumnWidth = 136
const tableHeaderHeight = 33
const tableRowHeight = 32
const tableFooterHeight = 32

function ObjectTableViewportState({
  filtered,
  loading,
  object,
  canCreate,
}: {
  readonly canCreate: boolean
  readonly filtered: boolean
  readonly loading: boolean
  readonly object: ObjectType
}) {
  const title = loading
    ? `Loading ${object.pluralName.toLowerCase()}…`
    : filtered
      ? `No matching ${object.pluralName.toLowerCase()}`
      : `No ${object.pluralName.toLowerCase()} to show`
  const description = loading
    ? "Records will appear as soon as they are available."
    : filtered
      ? "Change or clear the current filters."
      : canCreate
        ? `Create the first ${object.name.toLowerCase()} to get started.`
        : "Records will appear here when they are available."

  return (
    <div
      data-object-table-viewport-state=""
      className="pointer-events-none absolute inset-x-0 z-10 grid place-items-center"
      style={{ top: tableHeaderHeight + tableFooterHeight, bottom: 0 }}
    >
      <Empty className="h-full p-6" aria-live="polite">
        <EmptyHeader>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  )
}

function pinnedColumnStyle(column: ObjectTableColumn): CSSProperties {
  const pinned = column.getIsPinned()

  return {
    width: column.getSize(),
    position: pinned ? "sticky" : "relative",
    insetInlineStart: pinned === "start" ? column.getStart("start") : undefined,
    insetInlineEnd: pinned === "end" ? column.getAfter("end") : undefined,
  }
}

function SelectionHeader({
  table,
}: Pick<
  HeaderContext<typeof objectTableFeatures, ObjectTableRecord>,
  "table"
>) {
  return (
    <div className="flex size-full items-center justify-center">
      <Checkbox
        aria-label="Select all rows"
        disabled={!table.getRowModel().rows.some((row) => row.getCanSelect())}
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
}: Pick<CellContext<typeof objectTableFeatures, ObjectTableRecord>, "row">) {
  return (
    <div className="flex size-full items-center justify-center">
      <Checkbox
        aria-label={`Select row ${row.getDisplayIndex() + 1}`}
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
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
  if (propertyId === titlePropertyId) return titleColumnWidth
  if (propertyKind === "enum") return 168
  if (propertyKind === "image") return 88
  return 200
}

export function ObjectTable({
  canDeleteRecord,
  canFilterProperty,
  canSortProperty,
  canUpdateRecord,
  columnFilters,
  columnVisibility,
  object,
  onCellCommit,
  onCreateRecord,
  onDeleteRecords,
  parentLabel,
  records,
  recordHref,
  onColumnFiltersChange,
  onColumnVisibilityChange,
  onSortingChange,
  pagination,
  renderRecordActions,
  toolbarActions,
  resolveImageSrc,
  resolveRecordLabel,
  sorting,
  tableTitle,
  visiblePropertyIds,
}: ObjectTableProps) {
  const [isHorizontallyScrolled, setIsHorizontallyScrolled] = useState(false)
  const properties = useMemo(() => {
    const entries = [
      ...(object.parent.kind === "root"
        ? []
        : [
            [
              "parent",
              {
                ...schema.recordId(
                  { id: object.parent.typeId },
                  { label: parentLabel ?? "Parent" }
                ),
                immutable: true,
                nullable: false,
                outputOnly: false,
                requiredOnCreate: true,
              } satisfies PropertyDefinition,
            ] as const,
          ]),
      ...Object.entries(object.properties),
    ]
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
  }, [object.display.title, object.parent, object.properties, parentLabel])
  const columns = useMemo(() => {
    return columnHelper.columns(
      properties.map(([propertyId, property]) => {
        const isIdentity = propertyId === object.display.title
        const label = isIdentity ? object.name : (property.label ?? propertyId)

        return columnHelper.accessor((record) => record[propertyId], {
          id: propertyId,
          enableColumnFilter: canFilterProperty?.(property) ?? true,
          enableHiding: propertyId !== object.display.title,
          enableResizing: true,
          enableSorting: canSortProperty?.(property) ?? true,
          filterFn: "objectProperty",
          sortFn: "objectProperty",
          sortUndefined: "last",
          size: propertyColumnSize(
            propertyId,
            property.kind,
            object.display.title
          ),
          minSize:
            propertyId === object.display.title
              ? selectionControlWidth + 176
              : 120,
          maxSize: 560,
          header: label,
          meta: {
            essential: isIdentity,
            label,
            property,
            propertyId,
          },
        })
      })
    )
  }, [canFilterProperty, canSortProperty, object, properties])

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
      columnPinning: {
        start: [object.display.title],
        end: [],
      },
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
    enableRowSelection:
      canDeleteRecord === undefined
        ? true
        : (row) => canDeleteRecord(row.original.id),
    enableSortingRemoval: true,
    manualFiltering: onColumnFiltersChange !== undefined,
    manualSorting: onSortingChange !== undefined,
    ...(onColumnFiltersChange === undefined ? {} : { onColumnFiltersChange }),
    ...(onColumnVisibilityChange === undefined
      ? {}
      : { onColumnVisibilityChange }),
    ...(onSortingChange === undefined ? {} : { onSortingChange }),
    state: {
      ...(columnFilters === undefined ? {} : { columnFilters }),
      ...(columnVisibility === undefined ? {} : { columnVisibility }),
      ...(sorting === undefined ? {} : { sorting }),
    },
  })

  const visibleRows = table.getRowModel().rows
  const hasActiveFilters = table.state.columnFilters.length > 0
  const hasNoVisibleRows = visibleRows.length === 0
  const isInitialLoading = pagination?.loading === true && records.length === 0
  const visibleColumns = table.getVisibleLeafColumns()
  const navigableColumns = visibleColumns.filter(
    (column) => column.columnDef.meta?.property !== undefined
  )
  const navigation = useObjectTableNavigation({
    columnIds: navigableColumns.map((column) => column.id),
    rowIds: visibleRows.map((row) => row.id),
  })
  const renderedTableWidth = table.getTotalSize() + addColumnWidth
  const renderedTableSurfaceHeight =
    tableHeaderHeight + tableRowHeight * visibleRows.length + tableFooterHeight
  const recordCountLabel = pagination
    ? `${pagination.totalSize} total`
    : visibleRows.length === records.length
      ? `${records.length} ${records.length === 1 ? object.name.toLowerCase() : object.pluralName.toLowerCase()}`
      : `${visibleRows.length} of ${records.length} ${object.pluralName.toLowerCase()}`

  return (
    <section
      aria-label={`${object.pluralName} table`}
      className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-background"
    >
      <ObjectTableToolbar
        object={object}
        table={table}
        tableTitle={tableTitle}
        onCreateRecord={onCreateRecord}
        onDeleteRecords={onDeleteRecords}
        toolbarActions={toolbarActions}
      />

      <div className="flex h-7 shrink-0 items-center gap-1.5 border-b px-5 text-[11px] text-muted-foreground sm:hidden">
        <ArrowRightIcon className="size-3" />
        Swipe horizontally to see all columns
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <Table
          containerClassName="size-full overflow-auto"
          className="table-fixed border-separate border-spacing-0"
          role="grid"
          aria-colcount={visibleColumns.length + 1}
          aria-rowcount={visibleRows.length + 2}
          style={{ minWidth: "100%", width: renderedTableWidth }}
          onContainerScroll={(event) =>
            setIsHorizontallyScrolled(event.currentTarget.scrollLeft !== 0)
          }
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
                      className={cn(
                        "relative h-8 border-r border-b p-0 text-xs",
                        header.column.getIsPinned()
                          ? "z-10 bg-background"
                          : "bg-muted/20"
                      )}
                      style={pinnedColumnStyle(header.column)}
                    >
                      {header.isPlaceholder ? null : meta?.property ===
                        undefined ? (
                        <table.FlexRender header={header} />
                      ) : meta.propertyId === object.display.title ? (
                        <div className="flex size-full min-w-0">
                          <div
                            className="h-full shrink-0"
                            style={{ width: selectionControlWidth }}
                          >
                            <SelectionHeader table={table} />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 min-w-0 flex-1 justify-start overflow-hidden px-2 font-medium hover:bg-muted"
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
                        </div>
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
            {visibleRows.map((row, rowIndex) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className="group h-8 hover:bg-muted/30"
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta
                  const pinned = cell.column.getIsPinned()
                  if (
                    meta?.property === undefined ||
                    meta.propertyId === undefined
                  ) {
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "h-8 overflow-hidden border-r p-0",
                          pinned && objectTablePinnedCellClassName
                        )}
                        style={pinnedColumnStyle(cell.column)}
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
                    (canUpdateRecord !== undefined &&
                      !canUpdateRecord(row.original.id)) ||
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
                        "relative z-0 h-8 border-r p-0",
                        pinned && objectTablePinnedCellClassName,
                        active
                          ? cn(
                              pinned
                                ? "z-30 overflow-visible"
                                : "z-[1] overflow-visible",
                              objectTableCellSelectionClassName
                            )
                          : "overflow-hidden outline-none"
                      )}
                      style={pinnedColumnStyle(cell.column)}
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
                      <div
                        className={cn(
                          "h-full min-w-0",
                          meta.propertyId === object.display.title && "flex"
                        )}
                      >
                        {meta.propertyId === object.display.title ? (
                          <div
                            className="h-full shrink-0"
                            style={{ width: selectionControlWidth }}
                          >
                            <SelectionCell row={row} />
                          </div>
                        ) : null}
                        <div className="min-w-0 flex-1">
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
                                ? {
                                    href: recordHref?.(row.original.id),
                                    object,
                                    record: row.original,
                                  }
                                : undefined
                            }
                            property={meta.property}
                            resolveImageSrc={resolveImageSrc}
                            resolveRecordLabel={resolveRecordLabel}
                            value={cellValue}
                            onCancelEditing={() =>
                              navigation.cancelCellEditing(address)
                            }
                            onEditingChange={(nextEditing) =>
                              navigation.setCellEditing(address, nextEditing)
                            }
                            onCommit={commitCell}
                          />
                        </div>
                      </div>
                    </TableCell>
                  )
                })}
                <TableCell
                  className="h-8 border-r p-0"
                  style={{ width: addColumnWidth }}
                >
                  {renderRecordActions === undefined ? null : (
                    <div className="flex h-full items-center justify-end gap-1 px-1">
                      {renderRecordActions(row.original)}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="sticky bottom-0 z-20 bg-background font-normal">
            <TableRow className="h-8 hover:bg-transparent">
              {visibleColumns.map((column) => (
                <TableCell
                  key={column.id}
                  className={cn(
                    "h-8 border-y border-r bg-background p-0 text-muted-foreground",
                    column.getIsPinned() && "z-10"
                  )}
                  style={pinnedColumnStyle(column)}
                >
                  {column.id === object.display.title ? (
                    <div className="flex h-full items-center justify-end px-2 tabular-nums">
                      {recordCountLabel}
                    </div>
                  ) : null}
                </TableCell>
              ))}
              <TableCell
                className="h-8 border-y border-r bg-background p-0"
                style={{ width: addColumnWidth }}
              >
                {pagination === undefined ? null : (
                  <div className="flex h-full items-center justify-end px-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Previous page"
                      disabled={
                        pagination.loading || !pagination.hasPreviousPage
                      }
                      onClick={pagination.onPreviousPage}
                    >
                      <ChevronLeftIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Next page"
                      disabled={pagination.loading || !pagination.hasNextPage}
                      onClick={pagination.onNextPage}
                    >
                      <ChevronRightIcon />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>

        {hasNoVisibleRows ? (
          <ObjectTableViewportState
            canCreate={onCreateRecord !== undefined}
            filtered={hasActiveFilters}
            loading={isInitialLoading}
            object={object}
          />
        ) : null}

        {isHorizontallyScrolled ? (
          <div
            aria-hidden="true"
            data-object-table-scroll-shadow=""
            className="pointer-events-none absolute top-0 z-40 w-3"
            style={{
              backgroundImage:
                "linear-gradient(to right, color-mix(in oklab, var(--foreground) 5%, transparent), transparent)",
              height: `min(100%, ${renderedTableSurfaceHeight}px)`,
              insetInlineStart: table.getStartTotalSize(),
            }}
          />
        ) : null}
      </div>
    </section>
  )
}
