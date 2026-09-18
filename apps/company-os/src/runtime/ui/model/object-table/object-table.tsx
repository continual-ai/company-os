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
import { Table, TableHead, TableHeader, TableRow } from "@company/ui/table"
import {
  createColumnHelper,
  useTable,
  type ColumnFiltersState,
  type HeaderContext,
  type OnChangeFn,
  type SortingState,
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
  type ReactNode,
  useRef,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react"

import { type ObjectType } from "#/runtime/model/index.ts"
import { objectFields } from "#/runtime/model/object-fields.ts"
import { CollectionPagination } from "#/runtime/ui/model/collection-pagination.tsx"
import { formatTotalSize } from "#/runtime/ui/model/format-total-size.ts"
import { ObjectIcon } from "#/runtime/ui/model/object-record-identity.tsx"
import { ObjectTableBody } from "#/runtime/ui/model/object-table/object-table-body.tsx"
import {
  objectTablePinnedColumnStyle,
  useObjectTableColumnLayout,
} from "#/runtime/ui/model/object-table/object-table-cell-styles.ts"
import { objectTableFieldColumnDef } from "#/runtime/ui/model/object-table/object-table-columns.ts"
import {
  objectTableFeatures,
  type ObjectTableImageResolver,
  type ObjectTableRecord,
  type ObjectTableRecordResolver,
  type ObjectTableValue,
} from "#/runtime/ui/model/object-table/object-table-config.ts"
import { useObjectTableNavigation } from "#/runtime/ui/model/object-table/object-table-navigation.ts"
import { ObjectTableProperty } from "#/runtime/ui/model/object-table/object-table-property.tsx"
import {
  ObjectTableColumnMenu,
  ObjectTableToolbar,
} from "#/runtime/ui/model/object-table/object-table-toolbar.tsx"
import {
  tableHeaderHeight,
  tableRowHeight,
} from "#/runtime/ui/model/object-table/object-table-virtualization.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"
import type { TableRange } from "#/runtime/ui/model/use-viewport-pages.ts"

interface ObjectTableViewport {
  readonly loading: boolean
  readonly totalSize: number
  readonly totalSizeExact: boolean
  readonly indices: ReadonlyMap<string, number>
  readonly onRangeChange: (range: TableRange) => void
}

export interface ObjectTableProps {
  search?: { value: string; onChange: (value: string) => void } | undefined
  viewport?: ObjectTableViewport | undefined
  canDeleteRecord?: ((recordId: string) => boolean) | undefined
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
  records: ReadonlyArray<ObjectTableRecord>
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
        readonly totalSizeExact: boolean
      }
    | undefined
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

export function ObjectTable({
  search,
  canDeleteRecord,
  canUpdateRecord,
  columnFilters,
  columnVisibility,
  enableRowSelection = true,
  object,
  onCellCommit,
  onCreateRecord,
  onDeleteRecords,
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
  viewport,
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
  const runtime = useModelRuntime()
  const fields = useMemo(
    () => objectFields(object, runtime.model),
    [object, runtime.model]
  )
  const columns = useMemo(() => {
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
          }),
        ]
      : []

    return columnHelper.columns([
      ...selectionColumns,
      ...fields.map((field) =>
        objectTableFieldColumnDef(object, field, resolveRecord)
      ),
    ])
  }, [fields, object, resolveRecord, enableRowSelection])

  const initialState = useMemo(() => {
    const defaultPropertyIds = new Set(
      visiblePropertyIds ??
        [
          object.display.title,
          object.display.status,
          object.display.subtitle,
          ...Object.keys(object.properties),
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
        fields.map((field) => [
          field.id,
          defaultPropertyIds.has(field.id) ||
            (visiblePropertyIds === undefined &&
              field.kind === "link" &&
              field.traversal.traversal.max === 1),
        ])
      ),
    }
  }, [object, enableRowSelection, fields, visiblePropertyIds])

  const mergedVisibility = useMemo(
    () => ({ ...initialState.columnVisibility, ...columnVisibility }),
    [initialState.columnVisibility, columnVisibility]
  )
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
      ...(columnVisibility === undefined
        ? {}
        : {
            columnVisibility: mergedVisibility,
          }),
      ...(sorting === undefined ? {} : { sorting }),
    },
  })

  const visibleRows = table.getRowModel().rows
  const rowIds = useMemo(() => visibleRows.map((row) => row.id), [visibleRows])
  const rowsByIndex = useMemo(
    () =>
      new Map(
        rowIds.map((id, index) => [viewport?.indices.get(id) ?? index, id])
      ),
    [rowIds, viewport?.indices]
  )
  const hasActiveFilters =
    table.state.columnFilters.length > 0 || !!search?.value
  const hasNoVisibleRows = visibleRows.length === 0
  const isInitialLoading =
    (viewport?.loading === true || pagination?.loading === true) &&
    records.length === 0
  const visibleColumns = table.getVisibleLeafColumns()
  const navigableColumnIds = useMemo(
    () =>
      visibleColumns
        .filter((column) => column.columnDef.meta?.property !== undefined)
        .map((column) => column.id),
    [visibleColumns]
  )
  const rowLayout = useObjectTableColumnLayout(table)
  const navigation = useObjectTableNavigation({
    columnIds: navigableColumnIds,
    rowIds,
    rowsByIndex,
    rowCount: viewport?.totalSize ?? rowIds.length,
  })
  const scrollRef = useRef<HTMLDivElement>(null)
  const resetViewport = useEffectEvent(() => {
    table.resetRowSelection(true)
    navigation.clearCell()
    scrollRef.current?.scrollTo({ top: 0 })
  })
  useEffect(() => {
    resetViewport()
  }, [resetKey])
  const renderedTableWidth = table.getTotalSize() + addColumnWidth
  const renderedTableSurfaceHeight =
    tableHeaderHeight +
    tableRowHeight * (viewport?.totalSize ?? visibleRows.length)

  return (
    <section
      aria-label={`${object.pluralName} table`}
      className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-background"
    >
      <ObjectTableToolbar
        search={search}
        object={object}
        table={table}
        tableTitle={tableTitle}
        onCreateRecord={onCreateRecord}
        onDeleteRecords={onDeleteRecords}
        canDeleteRecord={canDeleteRecord}
        renderSelectedRecordActions={renderSelectedRecordActions}
        toolbarActions={toolbarActions}
      />

      <div className="flex h-7 shrink-0 items-center gap-1.5 border-b px-page-gutter text-[11px] text-muted-foreground sm:hidden">
        <ArrowRightIcon className="size-3" />
        Swipe horizontally to see all columns
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <Table
          containerClassName="size-full overflow-auto overscroll-none"
          containerRef={scrollRef}
          className="table-fixed border-separate border-spacing-0"
          role="grid"
          aria-colcount={visibleColumns.length + 1}
          aria-rowcount={
            (viewport?.totalSizeExact ?? pagination?.totalSizeExact) === false
              ? -1
              : (viewport?.totalSize ??
                  pagination?.totalSize ??
                  visibleRows.length) + 1
          }
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
                      style={objectTablePinnedColumnStyle(header.column)}
                    >
                      {header.isPlaceholder ? null : meta?.property ===
                        undefined ? (
                        <table.FlexRender header={header} />
                      ) : meta.propertyId === object.display.title ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 w-full justify-start overflow-hidden rounded-none px-2 font-medium hover:bg-muted"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <ObjectTableProperty
                            label={meta.label}
                            property={meta.displayProperty ?? meta.property}
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
                          className="h-8 w-full justify-start overflow-hidden rounded-none px-2 font-medium hover:bg-muted"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <ObjectTableProperty
                            label={meta.label}
                            property={meta.displayProperty ?? meta.property}
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
                {/* Leave the trailing column flexible so extra viewport width never stretches data columns or their sticky offsets. */}
                <TableHead className="h-8 border-b bg-muted/20 p-0">
                  <ObjectTableColumnMenu compact table={table} />
                </TableHead>
              </TableRow>
            ))}
          </TableHeader>
          <ObjectTableBody
            rowIds={rowIds}
            rowsByIndex={rowsByIndex}
            viewport={viewport}
            retainedRowIds={[
              navigation.activeCell?.rowId ?? visibleRows[0]?.id,
              navigation.editingCell?.rowId,
            ]}
            scrollRef={scrollRef}
            columnCount={visibleColumns.length + 1}
            pagination={pagination}
            table={table}
            navigation={navigation}
            canUpdateRecord={canUpdateRecord}
            rowProps={{
              FlexRender: table.FlexRender,
              layout: rowLayout,
              object,
              navigableColumnIds,
              onCellCommit,
              recordHref,
              resolveRecord,
              resolveImageSrc,
            }}
          />
        </Table>

        {hasNoVisibleRows ? (
          <ObjectTableViewportState
            filtered={hasActiveFilters}
            loading={isInitialLoading}
            object={object}
            onClearFilters={() => {
              table.resetColumnFilters(true)
              search?.onChange("")
            }}
            onCreate={onCreateRecord}
          />
        ) : null}

        {isHorizontallyScrolled ? (
          <div
            aria-hidden="true"
            data-object-table-scroll-shadow=""
            className="pointer-events-none absolute top-0 z-40 w-[3px] bg-foreground/5"
            style={{
              height: `min(100%, ${renderedTableSurfaceHeight}px)`,
              insetInlineStart: table.getStartTotalSize(),
            }}
          />
        ) : null}
      </div>
      {viewport && (
        <div className="flex h-9 shrink-0 items-center border-t px-page-gutter text-xs text-muted-foreground">
          {formatTotalSize(viewport)} records
        </div>
      )}
      {pagination && (
        <CollectionPagination loaded={records.length} {...pagination} />
      )}
    </section>
  )
}
