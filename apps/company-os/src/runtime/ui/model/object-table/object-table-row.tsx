import { cn } from "@company/ui/lib/utils"
import { TableCell, TableRow } from "@company/ui/table"
import { memo } from "react"

import {
  objectTableCellSelectionClassName,
  objectTablePinnedCellClassName,
  objectTablePinnedColumnStyle,
} from "#/runtime/ui/model/object-table/object-table-cell-styles.ts"
import {
  isObjectTableCellEditable,
  objectTableCellShouldExpand,
} from "#/runtime/ui/model/object-table/object-table-cell-types.ts"
import { ObjectTableCell } from "#/runtime/ui/model/object-table/object-table-cell.tsx"
import type { ObjectTableColumn } from "#/runtime/ui/model/object-table/object-table-columns.ts"
import {
  objectTableValueText,
  type ObjectTableInstance,
  type ObjectTableValue,
} from "#/runtime/ui/model/object-table/object-table-config.ts"
import { ObjectTableLinkCell } from "#/runtime/ui/model/object-table/object-table-link-cell.tsx"
import type { useObjectTableNavigation } from "#/runtime/ui/model/object-table/object-table-navigation.ts"
import type { ObjectTableProps } from "#/runtime/ui/model/object-table/object-table.tsx"

export interface ObjectTableRowProps extends Pick<
  ObjectTableProps,
  | "object"
  | "canUpdateRecord"
  | "onCellCommit"
  | "recordHref"
  | "resolveRecord"
  | "resolveImageSrc"
> {
  row: ReturnType<ObjectTableInstance["getRowModel"]>["rows"][number]
  rowIndex: number
  table: ObjectTableInstance
  // Table instances are mutable; the snapshot also invalidates memoized column layout.
  tableState: ObjectTableInstance["state"]
  navigation: ReturnType<typeof useObjectTableNavigation>
  navigableColumns: ReadonlyArray<ObjectTableColumn>
}

export const ObjectTableRow = memo(function ObjectTableRow({
  row,
  rowIndex,
  table,
  tableState,
  object,
  navigation,
  navigableColumns,
  canUpdateRecord,
  onCellCommit,
  recordHref,
  resolveRecord,
  resolveImageSrc,
}: ObjectTableRowProps) {
  return (
    <TableRow
      aria-rowindex={rowIndex + 2}
      data-state={tableState.rowSelection[row.id] ? "selected" : undefined}
      className="group h-8 hover:bg-muted/30 [&>td]:inset-shadow-[0_-1px_var(--border)]"
    >
      {row.getVisibleCells().map((cell) => {
        const meta = cell.column.columnDef.meta
        const pinned = cell.column.getIsPinned()
        if (meta?.property === undefined || meta.propertyId === undefined) {
          return (
            <TableCell
              key={cell.id}
              className={cn(
                "h-8 overflow-hidden p-0",
                cell.column.id !== "selection" && "border-r",
                pinned && objectTablePinnedCellClassName
              )}
              style={objectTablePinnedColumnStyle(cell.column)}
            >
              {meta?.link ? (
                <ObjectTableLinkCell
                  object={object}
                  record={row.original}
                  link={meta.link}
                  resolveRecord={resolveRecord}
                  editable={canUpdateRecord?.(row.original.id) ?? false}
                />
              ) : (
                <table.FlexRender cell={cell} />
              )}
            </TableCell>
          )
        }

        const address = {
          rowId: row.id,
          columnId: cell.column.id,
        }
        const propertyId = meta.propertyId
        const cellValue = cell.getValue<ObjectTableValue>() ?? null
        const active = navigation.isActive(address)
        const tabbable = navigation.isTabbable(address)
        const editing = navigation.isEditing(address)
        const expandActive =
          active &&
          !editing &&
          objectTableCellShouldExpand(meta.property, {
            displayLength: objectTableValueText(cellValue).length,
            valueCount: Array.isArray(cellValue) ? cellValue.length : 0,
          })
        const columnIndex = navigableColumns.findIndex(
          (column) => column.id === cell.column.id
        )
        const commitCell =
          onCellCommit === undefined ||
          (canUpdateRecord !== undefined &&
            !canUpdateRecord(row.original.id)) ||
          !meta.editable ||
          !isObjectTableCellEditable(meta.property)
            ? undefined
            : (nextValue: ObjectTableValue) =>
                onCellCommit(row.original.id, propertyId, nextValue)
        const editable = commitCell !== undefined

        return (
          <TableCell
            key={cell.id}
            ref={(element) => navigation.registerCell(address, element)}
            data-object-table-cell=""
            aria-selected={active}
            tabIndex={tabbable ? 0 : -1}
            className={cn(
              "relative z-0 h-8 scroll-mt-9 scroll-mb-9 border-r p-0",
              pinned && objectTablePinnedCellClassName,
              active
                ? cn(
                    pinned ? "z-30 overflow-visible" : "z-[1] overflow-visible",
                    objectTableCellSelectionClassName
                  )
                : "overflow-hidden outline-none"
            )}
            style={objectTablePinnedColumnStyle(cell.column)}
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
                    editing ? navigation.editingCell?.initialValue : undefined
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
                  property={meta.displayProperty ?? meta.property}
                  resolveImageSrc={resolveImageSrc}
                  resolveRecord={resolveRecord}
                  value={cellValue}
                  onCancelEditing={() => navigation.cancelCellEditing(address)}
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
      <TableCell className="h-8 border-r p-0" />
    </TableRow>
  )
})
