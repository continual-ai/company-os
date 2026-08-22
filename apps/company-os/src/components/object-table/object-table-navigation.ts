import { useCallback, useReducer, useRef } from "react"
import type { KeyboardEvent } from "react"

export interface ObjectTableCellAddress {
  columnId: string
  rowId: string
}

interface ObjectTableCellEditState extends ObjectTableCellAddress {
  initialValue?: string | undefined
}

interface ObjectTableNavigationState {
  activeCell: ObjectTableCellAddress | null
  editingCell: ObjectTableCellEditState | null
}

type ObjectTableNavigationAction =
  | { address: ObjectTableCellAddress; type: "activate" }
  | {
      address: ObjectTableCellAddress
      initialValue?: string | undefined
      type: "edit"
    }
  | { address: ObjectTableCellAddress; type: "cancel-editing" }
  | { type: "clear" }

export const objectTableNavigationInitialState: ObjectTableNavigationState = {
  activeCell: null,
  editingCell: null,
}

function cellKey({ columnId, rowId }: ObjectTableCellAddress): string {
  return `${rowId}\u0000${columnId}`
}

function isSameCell(
  first: ObjectTableCellAddress | null,
  second: ObjectTableCellAddress | null
): boolean {
  return first?.columnId === second?.columnId && first?.rowId === second?.rowId
}

export function reduceObjectTableNavigationState(
  state: ObjectTableNavigationState,
  action: ObjectTableNavigationAction
): ObjectTableNavigationState {
  switch (action.type) {
    case "activate":
    case "cancel-editing":
      return { activeCell: action.address, editingCell: null }
    case "clear":
      return objectTableNavigationInitialState
    case "edit":
      return {
        activeCell: action.address,
        editingCell: {
          ...action.address,
          initialValue: action.initialValue,
        },
      }
  }

  return state
}

export function useObjectTableNavigation({
  columnIds,
  rowIds,
}: {
  columnIds: ReadonlyArray<string>
  rowIds: ReadonlyArray<string>
}) {
  const [cellState, dispatch] = useReducer(
    reduceObjectTableNavigationState,
    objectTableNavigationInitialState
  )
  const { activeCell, editingCell } = cellState
  const cellElements = useRef(new Map<string, HTMLTableCellElement>())

  const cellExists = (address: ObjectTableCellAddress) =>
    rowIds.includes(address.rowId) && columnIds.includes(address.columnId)
  const resolvedActiveCell =
    activeCell !== null && cellExists(activeCell) ? activeCell : null
  const resolvedEditingCell =
    editingCell !== null && cellExists(editingCell) ? editingCell : null
  const firstCell =
    rowIds[0] === undefined || columnIds[0] === undefined
      ? null
      : { rowId: rowIds[0], columnId: columnIds[0] }

  const focusCell = useCallback((address: ObjectTableCellAddress) => {
    window.requestAnimationFrame(() => {
      const element = cellElements.current.get(cellKey(address))
      element?.focus({ preventScroll: true })
      element?.scrollIntoView({ block: "nearest", inline: "nearest" })
    })
  }, [])

  const activateCell = useCallback(
    (address: ObjectTableCellAddress, focus = false) => {
      dispatch({ type: "activate", address })
      if (focus) focusCell(address)
    },
    [focusCell]
  )

  const setCellEditing = useCallback(
    (
      address: ObjectTableCellAddress,
      editing: boolean,
      initialValue?: string
    ) => {
      dispatch(
        editing
          ? { type: "edit", address, initialValue }
          : { type: "cancel-editing", address }
      )
      if (!editing) {
        window.requestAnimationFrame(() => {
          if (document.activeElement === document.body) focusCell(address)
        })
      }
    },
    [focusCell]
  )

  const cancelCellEditing = useCallback(
    (address: ObjectTableCellAddress) => {
      dispatch({ type: "cancel-editing", address })
      focusCell(address)
    },
    [focusCell]
  )

  const clearCell = useCallback(() => {
    dispatch({ type: "clear" })
  }, [])

  const moveCellFocus = useCallback(
    (rowIndex: number, columnIndex: number) => {
      const rowId = rowIds[rowIndex]
      const columnId = columnIds[columnIndex]
      if (rowId === undefined || columnId === undefined) return
      activateCell({ rowId, columnId }, true)
    },
    [activateCell, columnIds, rowIds]
  )

  const handleCellKeyDown = useCallback(
    (
      event: KeyboardEvent<HTMLTableCellElement>,
      rowIndex: number,
      columnIndex: number,
      editable: boolean,
      address: ObjectTableCellAddress
    ) => {
      if (event.key === "Escape" && event.target === event.currentTarget) {
        event.preventDefault()
        clearCell()
        event.currentTarget.blur()
        return
      }
      if (
        resolvedEditingCell !== null ||
        event.target !== event.currentTarget
      ) {
        return
      }

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

      const lastRow = rowIds.length - 1
      const lastColumn = columnIds.length - 1
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
          const flatIndex = rowIndex * columnIds.length + columnIndex
          const nextFlatIndex = flatIndex + direction
          if (
            nextFlatIndex < 0 ||
            nextFlatIndex >= rowIds.length * columnIds.length
          ) {
            return
          }
          nextRow = Math.floor(nextFlatIndex / columnIds.length)
          nextColumn = nextFlatIndex % columnIds.length
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
      clearCell,
      columnIds.length,
      moveCellFocus,
      resolvedEditingCell,
      rowIds.length,
      setCellEditing,
    ]
  )

  return {
    activateCell,
    cancelCellEditing,
    clearCell,
    editingCell: resolvedEditingCell,
    handleCellKeyDown,
    isActive: (address: ObjectTableCellAddress) =>
      isSameCell(resolvedActiveCell, address),
    isEditing: (address: ObjectTableCellAddress) =>
      isSameCell(resolvedEditingCell, address),
    isTabbable: (address: ObjectTableCellAddress) =>
      isSameCell(resolvedActiveCell, address) ||
      (resolvedActiveCell === null && isSameCell(firstCell, address)),
    registerCell: (
      address: ObjectTableCellAddress,
      element: HTMLTableCellElement | null
    ) => {
      const key = cellKey(address)
      if (element === null) cellElements.current.delete(key)
      else cellElements.current.set(key, element)
    },
    setCellEditing,
  }
}
