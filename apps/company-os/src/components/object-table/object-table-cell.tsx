import { Badge } from "@acme/ui/components/badge"
import { Checkbox } from "@acme/ui/components/checkbox"
import { Input } from "@acme/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@acme/ui/components/select"
import { cn } from "@acme/ui/lib/utils"
import type { PropertyDefinition } from "@continual/runtime"
import { CheckIcon, CircleAlertIcon, LoaderCircleIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import {
  objectTableCellType,
  objectTableInputType,
  type ObjectTableCellType,
} from "./object-table-cell-types"
import type { ObjectTableValue } from "./object-table-config"

type SaveStatus = "error" | "idle" | "saved" | "saving"

interface ObjectTableCellProps {
  active: boolean
  editing: boolean
  onCommit?: ((value: ObjectTableValue) => Promise<void> | void) | undefined
  onEditingChange: (editing: boolean) => void
  property: PropertyDefinition
  value: ObjectTableValue
}

function displayValue(value: ObjectTableValue): string {
  if (value === null || value === undefined || value === "") return ""
  if (Array.isArray(value)) return value.join(", ")
  if (value === true) return "Yes"
  if (value === false) return "No"
  return value.toString()
}

function CellSaveStatus({ status }: { status: SaveStatus }) {
  return (
    <output
      aria-live="polite"
      className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center bg-inherit pl-1"
    >
      {status === "saving" ? (
        <>
          <LoaderCircleIcon
            aria-hidden="true"
            className="size-3 animate-spin text-muted-foreground"
          />
          <span className="sr-only">Saving</span>
        </>
      ) : null}
      {status === "saved" ? (
        <>
          <CheckIcon aria-hidden="true" className="size-3 text-foreground" />
          <span className="sr-only">Saved</span>
        </>
      ) : null}
      {status === "error" ? (
        <>
          <CircleAlertIcon
            aria-hidden="true"
            className="size-3 text-destructive"
          />
          <span className="sr-only">Save failed</span>
        </>
      ) : null}
    </output>
  )
}

function useCellCommit(
  onCommit: ObjectTableCellProps["onCommit"],
  onEditingChange: ObjectTableCellProps["onEditingChange"]
) {
  const [status, setStatus] = useState<SaveStatus>("idle")
  const version = useRef(0)
  const timer = useRef<number | null>(null)

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

  const commit = async (value: ObjectTableValue) => {
    onEditingChange(false)
    if (onCommit === undefined) return

    const commitVersion = version.current + 1
    version.current = commitVersion
    setStatus("saving")
    try {
      await onCommit(value)
      if (version.current !== commitVersion) return
      setStatus("saved")
      timer.current = window.setTimeout(() => setStatus("idle"), 900)
    } catch {
      if (version.current === commitVersion) setStatus("error")
    }
  }

  return { clearStatus, commit, status }
}

function CellDisplay({
  active,
  children,
  className,
  status,
}: {
  active: boolean
  children: React.ReactNode
  className?: string
  status: SaveStatus
}) {
  return (
    <div
      className={cn(
        "relative flex h-7 min-w-0 items-center overflow-hidden px-2",
        active
          ? "z-20 w-max max-w-[32rem] min-w-full bg-accent shadow-[3px_0_8px_-6px_color-mix(in_oklab,var(--foreground)_35%,transparent)]"
          : "w-full bg-background",
        className
      )}
    >
      {children}
      <CellSaveStatus status={status} />
    </div>
  )
}

function TextCell({
  active,
  editing,
  onCommit,
  onEditingChange,
  property,
  type,
  value,
}: ObjectTableCellProps & { type: ObjectTableCellType }) {
  const externalValue = displayValue(value)
  const [draft, setDraft] = useState(externalValue)
  const cancelBlur = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { clearStatus, commit, status } = useCellCommit(
    onCommit,
    onEditingChange
  )

  useEffect(() => {
    if (!editing) setDraft(externalValue)
  }, [editing, externalValue])

  useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing])

  if (editing) {
    return (
      <div className="relative h-7 w-full bg-background">
        <Input
          ref={inputRef}
          aria-label={property.label ?? "Cell value"}
          type={objectTableInputType(type)}
          className="h-7 border-ring pr-7 focus-visible:ring-0"
          value={draft}
          onChange={(event) => {
            clearStatus()
            setDraft(event.target.value)
          }}
          onBlur={() => {
            if (cancelBlur.current) {
              cancelBlur.current = false
              setDraft(externalValue)
              onEditingChange(false)
              return
            }
            if (draft === externalValue) {
              onEditingChange(false)
              return
            }
            void commit(type === "number" ? Number(draft) : draft)
          }}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === "Enter") event.currentTarget.blur()
            if (event.key === "Escape") {
              cancelBlur.current = true
              event.currentTarget.blur()
            }
          }}
        />
        <CellSaveStatus status={status} />
      </div>
    )
  }

  return (
    <CellDisplay
      active={active}
      status={status}
      className={type === "number" ? "justify-end text-right tabular-nums" : ""}
    >
      <span
        className={cn("min-w-0", active ? "whitespace-nowrap" : "truncate")}
      >
        {externalValue.length > 0 ? (
          externalValue
        ) : (
          <span className="text-muted-foreground/60">Empty</span>
        )}
      </span>
    </CellDisplay>
  )
}

function EnumSelectCell({
  active,
  editing,
  onCommit,
  onEditingChange,
  property,
  value,
}: Omit<ObjectTableCellProps, "property"> & {
  property: Extract<PropertyDefinition, { kind: "enum" }>
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { clearStatus, commit, status } = useCellCommit(
    onCommit,
    onEditingChange
  )
  const currentValue = displayValue(value)
  const choices =
    property.options ??
    property.values.map((option) => ({ label: option, value: option }))
  const currentLabel =
    choices.find((choice) => choice.value === currentValue)?.label ??
    currentValue

  useEffect(() => {
    if (editing) triggerRef.current?.focus()
  }, [editing])

  if (!editing) {
    return (
      <CellDisplay active={active} status={status} className="gap-1">
        {currentValue.length > 0 ? (
          <Badge variant="secondary" className="h-5 px-1.5 font-normal">
            {currentLabel}
          </Badge>
        ) : (
          <span className="text-muted-foreground/60">Empty</span>
        )}
      </CellDisplay>
    )
  }

  return (
    <div className="relative h-7 w-full bg-background px-1">
      <Select
        open={editing}
        value={currentValue || null}
        onOpenChange={(open) => {
          if (open) clearStatus()
          else onEditingChange(false)
        }}
        onValueChange={(nextValue) => {
          if (nextValue === null || nextValue === currentValue) return
          void commit(nextValue)
        }}
      >
        <SelectTrigger
          ref={triggerRef}
          size="sm"
          className="h-7 w-full border-ring px-1.5 shadow-none focus-visible:ring-0"
        >
          <SelectValue placeholder="Choose value…" />
        </SelectTrigger>
        <SelectContent align="start">
          {choices.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <CellSaveStatus status={status} />
    </div>
  )
}

function SelectCell(props: ObjectTableCellProps) {
  if (props.property.kind !== "enum") return null
  return <EnumSelectCell {...props} property={props.property} />
}

function BooleanCell({
  active,
  editing,
  onCommit,
  onEditingChange,
  value,
}: ObjectTableCellProps) {
  const checked = value === true
  const checkboxRef = useRef<HTMLButtonElement>(null)
  const { commit, status } = useCellCommit(onCommit, onEditingChange)

  useEffect(() => {
    if (editing) checkboxRef.current?.focus()
  }, [editing])

  if (editing) {
    return (
      <div className="relative flex h-7 w-full items-center bg-background px-2">
        <Checkbox
          ref={checkboxRef}
          aria-label="Cell value"
          checked={checked}
          onBlur={() => onEditingChange(false)}
          onCheckedChange={(nextChecked) => void commit(nextChecked)}
          onKeyDown={(event) => event.stopPropagation()}
        />
        <span className="ml-2 text-xs">{checked ? "Yes" : "No"}</span>
        <CellSaveStatus status={status} />
      </div>
    )
  }

  return (
    <CellDisplay active={active} status={status} className="gap-2">
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          checked ? "bg-foreground" : "bg-muted-foreground/35"
        )}
      />
      <span>{checked ? "Yes" : "No"}</span>
    </CellDisplay>
  )
}

export function ObjectTableCell(props: ObjectTableCellProps) {
  const type = objectTableCellType(props.property)

  if (type === "enum") return <SelectCell {...props} />
  if (type === "boolean") return <BooleanCell {...props} />
  return <TextCell {...props} type={type} />
}
