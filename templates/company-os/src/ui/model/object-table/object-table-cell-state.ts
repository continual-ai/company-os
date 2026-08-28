import { formatPhoneNumberForDisplay } from "@company/ui/lib/phone-number"
import { useEffect, useRef, useState } from "react"

import type { ObjectTableCellType } from "./object-table-cell-types"
import {
  objectTableValueText,
  type ObjectTableValue,
} from "./object-table-config"

export type ObjectTableCellCommit = (
  value: ObjectTableValue
) => Promise<void> | void
export type ObjectTableCellEditingChange = (editing: boolean) => void
export type ObjectTableCellSaveStatus = "error" | "idle" | "saved" | "saving"

const numberFormatter = new Intl.NumberFormat("en-US")
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
})
const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
  year: "numeric",
})

export function objectTableCellInputValue(value: ObjectTableValue): string {
  if (value === null || value === "") return ""
  if (Array.isArray(value)) return value.join(", ")
  if (value === true) return "Yes"
  if (value === false) return "No"
  return objectTableValueText(value)
}

function cellValuesEqual(
  first: ObjectTableValue,
  second: ObjectTableValue
): boolean {
  if (Array.isArray(first) && Array.isArray(second)) {
    return (
      first.length === second.length &&
      first.every((item, index) => item === second[index])
    )
  }
  return Object.is(first, second)
}

export function formatObjectTableCellText(
  type: ObjectTableCellType,
  fallback: string
): string {
  if (type === "number" && fallback.length > 0) {
    const number = Number(fallback)
    if (Number.isFinite(number)) return numberFormatter.format(number)
  }
  if (type === "date" && fallback.length > 0) {
    const date = new Date(`${fallback}T00:00:00`)
    if (!Number.isNaN(date.getTime())) return dateFormatter.format(date)
  }
  if (type === "timestamp" && fallback.length > 0) {
    const date = new Date(fallback)
    if (!Number.isNaN(date.getTime())) return timestampFormatter.format(date)
  }
  if (type === "phone" && fallback.length > 0) {
    return formatPhoneNumberForDisplay(fallback)
  }
  return fallback
}

export function useObjectTableCellCommit(
  value: ObjectTableValue,
  onCommit: ObjectTableCellCommit | undefined,
  onEditingChange: ObjectTableCellEditingChange
) {
  const [status, setStatus] = useState<ObjectTableCellSaveStatus>("idle")
  const [renderedValue, setRenderedValue] = useState(value)
  const committedValue = useRef(value)
  const pendingValue = useRef<{ value: ObjectTableValue } | null>(null)
  const version = useRef(0)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    committedValue.current = value
    if (
      pendingValue.current === null ||
      cellValuesEqual(pendingValue.current.value, value)
    ) {
      pendingValue.current = null
      setRenderedValue(value)
    }
  }, [value])

  useEffect(() => {
    return () => {
      version.current += 1
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  const clearStatus = () => {
    version.current += 1
    if (timer.current !== null) window.clearTimeout(timer.current)
    setStatus("idle")
  }

  const commit = async (nextValue: ObjectTableValue, closeEditor = true) => {
    pendingValue.current = { value: nextValue }
    setRenderedValue(nextValue)
    if (closeEditor) onEditingChange(false)
    if (onCommit === undefined) return
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }

    const commitVersion = version.current + 1
    version.current = commitVersion
    setStatus("saving")
    try {
      await onCommit(nextValue)
      if (version.current !== commitVersion) return
      pendingValue.current = null
      setStatus("saved")
      timer.current = window.setTimeout(() => {
        if (version.current === commitVersion) setStatus("idle")
        timer.current = null
      }, 900)
    } catch {
      if (version.current === commitVersion) {
        pendingValue.current = null
        setRenderedValue(committedValue.current)
        setStatus("error")
      }
    }
  }

  return { clearStatus, commit, renderedValue, status }
}
