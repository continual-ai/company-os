import { Checkbox } from "@company/ui/checkbox"
import { cn } from "@company/ui/lib/utils"
import { TableCell, TableRow } from "@company/ui/table"
import { memo, type CSSProperties } from "react"

import { ObjectFieldValue } from "#/runtime/ui/model/object-field.tsx"
import {
  objectTableCellSelectionClassName,
  objectTablePinnedCellClassName,
  objectTableRowClassName,
} from "#/runtime/ui/model/object-table/object-table-cell-styles.ts"
import { ObjectTableCellSurface } from "#/runtime/ui/model/object-table/object-table-cell-surface.tsx"
import {
  isObjectTableCellEditable,
  objectTableCellShouldExpand,
} from "#/runtime/ui/model/object-table/object-table-cell-types.ts"
import { ObjectTableCell } from "#/runtime/ui/model/object-table/object-table-cell.tsx"
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
  "object" | "onCellCommit" | "recordHref" | "resolveRecord" | "resolveImageSrc"
> {
  row: ReturnType<ObjectTableInstance["getRowModel"]>["rows"][number]
  rowIndex: number
  selected: boolean
  canUpdate: boolean | undefined
  FlexRender: ObjectTableInstance["FlexRender"]
  // Only column layout changes invalidate every row; selection and focus are row-local.
  layout: ReadonlyMap<
    string,
    { readonly pinned: boolean; readonly style: CSSProperties }
  >
  activeColumn?: string | undefined
  tabbableColumn?: string | undefined
  editingColumn?: string | undefined
  initialEditValue?: string | undefined
  navigation: ReturnType<typeof useObjectTableNavigation>["actions"]
  navigableColumnIds: ReadonlyArray<string>
}

export const ObjectTableRow = memo(function ObjectTableRow({
  row,
  rowIndex,
  selected,
  canUpdate,
  FlexRender,
  layout,
  activeColumn,
  tabbableColumn,
  editingColumn,
  initialEditValue,
  object,
  navigation,
  navigableColumnIds,
  onCellCommit,
  recordHref,
  resolveRecord,
  resolveImageSrc,
}: ObjectTableRowProps) {
  return (
    <TableRow
      aria-rowindex={rowIndex + 2}
      data-state={selected ? "selected" : undefined}
      className={objectTableRowClassName}
    >
      {row.getVisibleCells().map((cell) => {
        const meta = cell.column.columnDef.meta
        const { pinned, style } = layout.get(cell.column.id)!
        if (meta?.property === undefined || meta.propertyId === undefined) {
          return (
            <TableCell
              key={cell.id}
              className={cn(
                "h-8 overflow-hidden p-0",
                cell.column.id !== "selection" && "border-r",
                pinned && objectTablePinnedCellClassName
              )}
              style={style}
            >
              {cell.column.id === "selection" ? (
                <div className="flex size-full items-center pl-3 sm:pl-5">
                  <Checkbox
                    aria-label={`Select row ${rowIndex + 1}`}
                    checked={selected}
                    disabled={!row.getCanSelect()}
                    onClick={(event) => event.stopPropagation()}
                    onDoubleClick={(event) => event.stopPropagation()}
                    onCheckedChange={(checked) => row.toggleSelected(checked)}
                  />
                </div>
              ) : meta?.link ? (
                <ObjectTableLinkCell
                  object={object}
                  record={row.original}
                  link={meta.link}
                  resolveRecord={resolveRecord}
                  editable={canUpdate ?? false}
                />
              ) : (
                <FlexRender cell={cell} />
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
        const active = activeColumn === cell.column.id
        const tabbable = tabbableColumn === cell.column.id
        const editing = editingColumn === cell.column.id
        const expandActive =
          active &&
          !editing &&
          objectTableCellShouldExpand(meta.property, {
            displayLength: objectTableValueText(cellValue).length,
            valueCount: Array.isArray(cellValue) ? cellValue.length : 0,
          })
        const columnIndex = navigableColumnIds.indexOf(cell.column.id)
        const commitCell =
          onCellCommit === undefined ||
          canUpdate === false ||
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
            style={style}
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
                address,
                editing
              )
            }
          >
            <div className="h-full min-w-0">
              <div className="min-w-0">
                {meta.field?.kind === "related" ? (
                  <ObjectTableCellSurface
                    active={active}
                    expandActive={expandActive}
                  >
                    <ObjectFieldValue
                      field={meta.field}
                      record={row.original}
                      resolveRecord={resolveRecord}
                    />
                  </ObjectTableCellSurface>
                ) : (
                  <ObjectTableCell
                    active={active}
                    editing={editing}
                    expandActive={expandActive}
                    initialEditValue={editing ? initialEditValue : undefined}
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
                      navigation.setCellEditing(address, nextEditing)
                    }
                    onCommit={commitCell}
                  />
                )}
              </div>
            </div>
          </TableCell>
        )
      })}
      <TableCell className="h-8 border-r p-0" />
    </TableRow>
  )
})
