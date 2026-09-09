import { Button } from "@company/ui/button"
import { Checkbox } from "@company/ui/checkbox"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@company/ui/empty"
import { useKeyboardShortcuts } from "@company/ui/keyboard-shortcuts"
import { cn } from "@company/ui/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@company/ui/table"
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
  GripVerticalIcon,
  LoaderCircleIcon,
  PlusIcon,
  SearchXIcon,
} from "lucide-react"
import {
  Fragment,
  type CSSProperties,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react"
import type { ReactNode } from "react"

import {
  schema,
  type ObjectType,
  type PropertyDefinition,
} from "#/runtime/model/index.ts"
import { CollectionPagination } from "#/runtime/ui/model/collection-pagination.tsx"
import { ObjectIcon } from "#/runtime/ui/model/object-record-identity.tsx"
import {
  objectTableCellSelectionClassName,
  objectTablePinnedCellClassName,
} from "#/runtime/ui/model/object-table/object-table-cell-styles.ts"
import {
  isObjectTableCellEditable,
  objectTableCellShouldExpand,
} from "#/runtime/ui/model/object-table/object-table-cell-types.ts"
import { ObjectTableCell } from "#/runtime/ui/model/object-table/object-table-cell.tsx"
import type { ObjectTableColumn } from "#/runtime/ui/model/object-table/object-table-columns.ts"
import {
  objectTableFeatures,
  objectTableValueText,
  type ObjectTableImageResolver,
  type ObjectTableRecordResolver,
  type ObjectTableRecord,
  type ObjectTableValue,
} from "#/runtime/ui/model/object-table/object-table-config.ts"
import { useObjectTableNavigation } from "#/runtime/ui/model/object-table/object-table-navigation.ts"
import { ObjectTableProperty } from "#/runtime/ui/model/object-table/object-table-property.tsx"
import {
  ObjectTableColumnMenu,
  ObjectTableToolbar,
} from "#/runtime/ui/model/object-table/object-table-toolbar.tsx"
import {
  useObjectTableRows,
  tableHeaderHeight,
  tableRowHeight,
} from "#/runtime/ui/model/object-table/object-table-virtualization.ts"

export interface ObjectTableProps {
  canDeleteRecord?: ((recordId: string) => boolean) | undefined
  canFilterProperty?: ((property: PropertyDefinition) => boolean) | undefined
  canSortProperty?: ((property: PropertyDefinition) => boolean) | undefined
  canUpdateRecord?: ((recordId: string) => boolean) | undefined
  columnFilters?: ColumnFiltersState | undefined
  columnVisibility?: Readonly<Record<string, boolean>> | undefined
  enableRowSelection?: boolean | undefined
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
  resetKey?: string | undefined
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState> | undefined
  onColumnVisibilityChange?: OnChangeFn<Record<string, boolean>> | undefined
  onSortingChange?: OnChangeFn<SortingState> | undefined
  pagination?:
    | {
        readonly hasNextPage: boolean
        readonly error?: string | undefined
        readonly loading: boolean
        readonly onNextPage: () => void
        readonly totalSize: number
      }
    | undefined
  parentLabel?: string | undefined
  recordHref?: ((recordId: string) => string) | undefined
  renderSelectedRecordActions?: ((recordId: string) => ReactNode) | undefined
  toolbarActions?: ReactNode
  resolveImageSrc?: ObjectTableImageResolver | undefined
  resolveRecord?: ObjectTableRecordResolver | undefined
  sorting?: SortingState | undefined
  tableTitle?: ReactNode
  visiblePropertyIds?: ReadonlyArray<string> | undefined
}

const columnHelper = createColumnHelper<
  typeof objectTableFeatures,
  ObjectTableRecord
>()

const selectionControlWidth = 56
const titleColumnWidth = 276
const addColumnWidth = 136

function ObjectTableViewportState({
  onClearFilters,
  onCreate,
  filtered,
  loading,
  object,
}: {
  readonly filtered: boolean
  readonly loading: boolean
  readonly object: ObjectType
  readonly onClearFilters: () => void
  readonly onCreate?: (() => Promise<void> | void) | undefined
}) {
  const title = loading
    ? `Loading ${object.pluralName.toLowerCase()}…`
    : filtered
      ? `No matching ${object.pluralName.toLowerCase()}`
      : `No ${object.pluralName.toLowerCase()} yet`
  const description = loading
    ? "Records will appear as soon as they are available."
    : filtered
      ? "Change or clear the current filters."
      : onCreate !== undefined
        ? `Create the first ${object.name.toLowerCase()} to get started.`
        : "Records will appear here when they are available."

  return (
    <div
      data-object-table-viewport-state=""
      className="absolute inset-x-0 bottom-0 z-10 grid place-items-center"
      style={{ top: tableHeaderHeight }}
    >
      <Empty className="h-full p-6" aria-live="polite">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {loading ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : filtered ? (
              <SearchXIcon />
            ) : (
              <ObjectIcon object={object} />
            )}
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        {loading ? null : filtered ? (
          <EmptyContent>
            <Button type="button" variant="outline" onClick={onClearFilters}>
              Clear filters
            </Button>
          </EmptyContent>
        ) : onCreate === undefined ? null : (
          <EmptyContent>
            <Button type="button" onClick={() => void onCreate()}>
              <PlusIcon />
              New {object.name.toLowerCase()}
            </Button>
          </EmptyContent>
        )}
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
    <div className="flex size-full items-center pl-3 sm:pl-5">
      <Checkbox
        aria-label="Select all loaded rows"
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
    <div className="flex size-full items-center pl-3 sm:pl-5">
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
  enableRowSelection = true,
  object,
  onCellCommit,
  onCreateRecord,
  onDeleteRecords,
  parentLabel,
  records,
  resetKey,
  recordHref,
  onColumnFiltersChange,
  onColumnVisibilityChange,
  onSortingChange,
  pagination,
  renderSelectedRecordActions,
  toolbarActions,
  resolveImageSrc,
  resolveRecord,
  sorting,
  tableTitle,
  visiblePropertyIds,
}: ObjectTableProps) {
  useKeyboardShortcuts([
    {
      id: "table-move",
      key: "ArrowUp",
      label: "↑ ↓ ← →",
      description: "Move between focused cells",
      group: "Table",
    },
    {
      id: "table-edit",
      key: "Enter",
      label: "Enter / F2",
      description: "Edit the focused cell",
      group: "Table",
    },
    {
      id: "table-cancel",
      key: "Escape",
      label: "Esc",
      description: "Cancel cell editing or clear selection",
      group: "Table",
    },
  ])
  const [isHorizontallyScrolled, setIsHorizontallyScrolled] = useState(false)
  const properties = useMemo(() => {
    const entries = [
      ...(object.display.title === "id"
        ? [
            [
              "id",
              {
                ...schema.string({ label: "Record ID" }),
                immutable: true,
                nullable: false,
                outputOnly: true,
                requiredOnCreate: false,
              } satisfies PropertyDefinition,
            ] as const,
          ]
        : []),
      ...(object.parent.kind === "root"
        ? []
        : [
            [
              "parent",
              {
                ...schema.reference(
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
    const propertyColumns = properties.map(([propertyId, property]) => {
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
    })
    const selectionColumns = enableRowSelection
      ? [
          columnHelper.display({
            id: "selection",
            enableColumnFilter: false,
            enableHiding: false,
            enableResizing: false,
            enableSorting: false,
            size: selectionControlWidth,
            minSize: selectionControlWidth,
            maxSize: selectionControlWidth,
            header: SelectionHeader,
            cell: SelectionCell,
          }),
        ]
      : []

    return columnHelper.columns([...selectionColumns, ...propertyColumns])
  }, [
    canFilterProperty,
    canSortProperty,
    enableRowSelection,
    object,
    properties,
  ])

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
        start: [
          ...(enableRowSelection ? ["selection"] : []),
          object.display.title,
        ],
        end: [],
      },
      columnVisibility: Object.fromEntries(
        properties.map(([propertyId]) => [
          propertyId,
          defaultPropertyIds.has(propertyId),
        ])
      ),
    }
  }, [enableRowSelection, object.display, properties, visiblePropertyIds])

  const table = useTable({
    features: objectTableFeatures,
    columns,
    data: records,
    getRowId: (record) => record.id,
    initialState,
    columnResizeMode: "onChange",
    enableMultiSort: true,
    enableRowSelection,
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
  const {
    scrollRef,
    rows: virtualRows,
    lastVisibleIndex,
    remainingHeight,
  } = useObjectTableRows(
    visibleRows.map((row) => row.id),
    [
      navigation.activeCell?.rowId ?? visibleRows[0]?.id,
      navigation.editingCell?.rowId,
    ]
  )
  const resetViewport = useEffectEvent(() => {
    table.resetRowSelection(true)
    navigation.clearCell()
    scrollRef.current?.scrollTo({ top: 0 })
  })
  useEffect(() => {
    resetViewport()
  }, [resetKey])
  useEffect(() => {
    if (
      visibleRows.length > 0 &&
      lastVisibleIndex >= visibleRows.length - 12 &&
      pagination?.hasNextPage &&
      !pagination.loading &&
      pagination.error === undefined
    )
      pagination.onNextPage()
  }, [lastVisibleIndex, visibleRows.length, pagination])
  const renderedTableWidth = table.getTotalSize() + addColumnWidth
  const renderedTableSurfaceHeight =
    tableHeaderHeight + tableRowHeight * visibleRows.length

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
        canDeleteRecord={canDeleteRecord}
        renderSelectedRecordActions={renderSelectedRecordActions}
        toolbarActions={toolbarActions}
      />

      <div className="flex h-7 shrink-0 items-center gap-1.5 border-b px-5 text-[11px] text-muted-foreground sm:hidden">
        <ArrowRightIcon className="size-3" />
        Swipe horizontally to see all columns
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <Table
          containerClassName="size-full overflow-auto"
          containerRef={scrollRef}
          className="table-fixed border-separate border-spacing-0"
          role="grid"
          aria-colcount={visibleColumns.length + 1}
          aria-rowcount={(pagination?.totalSize ?? visibleRows.length) + 1}
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
                        "relative h-8 border-b p-0 text-xs",
                        header.column.id !== "selection" && "border-r",
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
            {virtualRows.map((virtualRow) => {
              const rowIndex = virtualRow.index
              const row = visibleRows[rowIndex]!
              const gap = virtualRow.gap
              return (
                <Fragment key={row.id}>
                  {gap > 0 && (
                    <TableRow aria-hidden="true">
                      <TableCell
                        colSpan={visibleColumns.length + 1}
                        className="border-0 p-0"
                        style={{ height: gap }}
                      />
                    </TableRow>
                  )}

                  <TableRow
                    aria-rowindex={rowIndex + 2}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className="group h-8 hover:bg-muted/30 [&>td]:inset-shadow-[0_-1px_var(--border)]"
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
                              "h-8 overflow-hidden p-0",
                              cell.column.id !== "selection" && "border-r",
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
                              onCellCommit(
                                row.original.id,
                                propertyId,
                                nextValue
                              )
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
                            "relative z-0 h-8 scroll-mt-9 scroll-mb-9 border-r p-0",
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
                          <div className="h-full min-w-0">
                            <div className="min-w-0">
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
                                resolveRecord={resolveRecord}
                                value={cellValue}
                                onCancelEditing={() =>
                                  navigation.cancelCellEditing(address)
                                }
                                onEditingChange={(nextEditing) =>
                                  navigation.setCellEditing(
                                    address,
                                    nextEditing
                                  )
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
                    />
                  </TableRow>
                </Fragment>
              )
            })}
            {virtualRows.length > 0 && (
              <TableRow aria-hidden="true">
                <TableCell
                  colSpan={visibleColumns.length + 1}
                  className="border-0 p-0"
                  style={{
                    height: remainingHeight,
                  }}
                />
              </TableRow>
            )}
          </TableBody>
        </Table>

        {hasNoVisibleRows ? (
          <ObjectTableViewportState
            filtered={hasActiveFilters}
            loading={isInitialLoading}
            object={object}
            onClearFilters={() => table.resetColumnFilters(true)}
            onCreate={onCreateRecord}
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
      {pagination && (
        <CollectionPagination loaded={records.length} {...pagination} />
      )}
    </section>
  )
}
