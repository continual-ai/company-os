import { Checkbox } from "@company/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@company/ui/command"
import { Input } from "@company/ui/input"
import { cn } from "@company/ui/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@company/ui/popover"
import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from "@company/ui/preview-card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@company/ui/select"
import { ImageIcon } from "lucide-react"
import { type ComponentType, useEffect, useRef, useState } from "react"

import { assetContentUrl } from "#/runtime/assets/ui/content-url.ts"
import { FileCell } from "#/runtime/assets/ui/file-cell.tsx"
import type {
  Choice,
  ObjectType,
  PropertyDefinition,
} from "#/runtime/model/index.ts"
import { ObjectChoiceBadge } from "#/runtime/ui/model/object-choice-badge.tsx"
import { ObjectRecordIdentity } from "#/runtime/ui/model/object-record-identity.tsx"
import { objectRecordHref } from "#/runtime/ui/model/object-routing.ts"
import {
  formatObjectTableCellText,
  objectTableCellInputValue,
  useObjectTableCellCommit,
  type ObjectTableCellCommit,
  type ObjectTableCellEditingChange,
} from "#/runtime/ui/model/object-table/object-table-cell-state.ts"
import {
  ObjectTableCellSurface,
  ObjectTableCellValidationMessage,
} from "#/runtime/ui/model/object-table/object-table-cell-surface.tsx"
import {
  objectTableCellType,
  objectTableInputType,
  objectTableLinkHref,
  objectTablePropertySchema,
  objectTableUrlDisplayValue,
  parseObjectTableCellInput,
  type ObjectTableCellType,
} from "#/runtime/ui/model/object-table/object-table-cell-types.ts"
import {
  objectTableImageValue,
  type ObjectTableImageResolver,
  type ObjectTableRecordResolver,
  type ObjectTableRecord,
  type ObjectTableValue,
} from "#/runtime/ui/model/object-table/object-table-config.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

interface ObjectTableCellProps {
  active: boolean
  editing: boolean
  expandActive: boolean
  identity?:
    | {
        href?: string | undefined
        object: ObjectType
        record: ObjectTableRecord
      }
    | undefined
  initialEditValue?: string | undefined
  onCommit?: ObjectTableCellCommit | undefined
  onCancelEditing: () => void
  onEditingChange: ObjectTableCellEditingChange
  property: PropertyDefinition
  resolveImageSrc?: ObjectTableImageResolver | undefined
  resolveRecord?: ObjectTableRecordResolver | undefined
  value: ObjectTableValue
}

function TextCell({
  active,
  editing,
  expandActive,
  initialEditValue,
  identity,
  onCommit,
  onCancelEditing,
  onEditingChange,
  property,
  resolveImageSrc,
  resolveRecord,
  type,
  value,
}: ObjectTableCellProps & { type: ObjectTableCellType }) {
  const runtime = useModelRuntime()

  const { clearStatus, commit, renderedValue, status } =
    useObjectTableCellCommit(value, onCommit, onEditingChange)
  const externalValue = objectTableCellInputValue(renderedValue)
  const [draft, setDraft] = useState(externalValue)
  const [validationError, setValidationError] = useState<string | null>(null)
  const cancelingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) {
      setDraft(externalValue)
      setValidationError(null)
      return undefined
    }

    const acceptsInitialValue =
      type !== "date" &&
      (type !== "number" || /^[+\-.0-9]$/.test(initialEditValue ?? ""))
    const nextDraft =
      initialEditValue !== undefined && acceptsInitialValue
        ? initialEditValue
        : externalValue
    setDraft(nextDraft)

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      if (initialEditValue === undefined || !acceptsInitialValue) {
        inputRef.current?.select()
      } else {
        inputRef.current?.setSelectionRange(nextDraft.length, nextDraft.length)
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [editing, externalValue, initialEditValue, type])

  if (editing) {
    return (
      <ObjectTableCellSurface
        active={active}
        expandActive={expandActive}
        status={status}
        className="overflow-visible p-0"
      >
        <div className="relative h-8 w-full">
          <Input
            ref={inputRef}
            aria-label={property.label ?? "Cell value"}
            aria-invalid={validationError !== null}
            type={objectTableInputType(type)}
            className={cn(
              "h-8 rounded-none border-0 bg-transparent px-2 shadow-none focus-visible:border-0 focus-visible:ring-0",
              type === "number" && "text-right tabular-nums"
            )}
            value={draft}
            onChange={(event) => {
              clearStatus()
              setValidationError(null)
              setDraft(event.target.value)
            }}
            onBlur={() => {
              if (cancelingRef.current) {
                cancelingRef.current = false
                return
              }
              if (draft === externalValue) {
                onEditingChange(false)
                return
              }
              const result = parseObjectTableCellInput(property, draft)
              if ("error" in result) {
                setValidationError(result.error)
                window.requestAnimationFrame(() => inputRef.current?.focus())
                return
              }
              void commit(result.value)
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur()
              if (event.key === "Escape") {
                event.preventDefault()
                event.stopPropagation()
                cancelingRef.current = true
                onCancelEditing()
              }
            }}
          />
          {validationError !== null ? (
            <ObjectTableCellValidationMessage>
              {validationError}
            </ObjectTableCellValidationMessage>
          ) : null}
        </div>
      </ObjectTableCellSurface>
    )
  }

  const href = objectTableLinkHref(type, externalValue)
  const opensNewWindow = type === "url"
  const reference =
    type === "recordId" ? resolveRecord?.(externalValue) : undefined
  const displayIdentity =
    identity ??
    (reference === undefined
      ? undefined
      : {
          ...reference,
          href: objectRecordHref(runtime, reference.object, externalValue),
        })
  const formattedValue = formatObjectTableCellText(type, externalValue)

  return (
    <ObjectTableCellSurface
      active={active}
      expandActive={expandActive}
      status={status}
      className={
        type === "number"
          ? "justify-end pr-2 text-right tabular-nums"
          : undefined
      }
    >
      {displayIdentity !== undefined ? (
        <ObjectRecordIdentity
          {...displayIdentity}
          resolveImageSrc={resolveImageSrc}
        />
      ) : href !== null ? (
        <a
          className={cn(
            "min-w-0 text-interactive underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none",
            active ? "whitespace-nowrap" : "truncate"
          )}
          href={href}
          rel={opensNewWindow ? "noreferrer" : undefined}
          target={opensNewWindow ? "_blank" : undefined}
          title={externalValue}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          {objectTableUrlDisplayValue(externalValue)}
        </a>
      ) : (
        <span
          title={externalValue.length > 0 ? externalValue : undefined}
          className={cn(
            "min-w-0",
            active && expandActive
              ? "leading-5 wrap-break-word whitespace-normal"
              : active
                ? "whitespace-nowrap"
                : "truncate"
          )}
        >
          {formattedValue.length > 0 ? (
            formattedValue
          ) : (
            <span className="text-muted-foreground/60">Empty</span>
          )}
        </span>
      )}
    </ObjectTableCellSurface>
  )
}

function ImageCell({
  active,
  expandActive,
  property,
  resolveImageSrc,
  value,
}: ObjectTableCellProps) {
  const image = objectTableImageValue(value)
  const src =
    image === null
      ? null
      : (resolveImageSrc?.(image) ?? assetContentUrl(image.assetId))
  const label = image?.alt ?? property.label ?? "Image"

  return (
    <ObjectTableCellSurface
      active={active}
      expandActive={expandActive}
      className="gap-1.5"
    >
      {image === null ? (
        <span className="text-muted-foreground/60">Empty</span>
      ) : src === null ? (
        <>
          <span className="flex size-5 shrink-0 items-center justify-center border bg-muted/40">
            <ImageIcon className="size-3 text-muted-foreground" />
          </span>
          <span className="truncate text-muted-foreground">{label}</span>
        </>
      ) : (
        <PreviewCard>
          <PreviewCardTrigger
            render={
              <span className="inline-flex min-w-0 items-center gap-1.5" />
            }
          >
            <img
              alt={label}
              className="size-5 shrink-0 border object-cover"
              src={src}
            />
            <span className="truncate">{label}</span>
          </PreviewCardTrigger>
          <PreviewCardContent className="w-64 p-2">
            <img
              alt={label}
              className="aspect-video w-full border bg-muted/30 object-contain"
              src={src}
            />
            <p className="mt-2 truncate px-1 text-muted-foreground">{label}</p>
          </PreviewCardContent>
        </PreviewCard>
      )}
    </ObjectTableCellSurface>
  )
}

function EnumSelectCell({
  active,
  editing,
  expandActive,
  onCommit,
  onCancelEditing,
  onEditingChange,
  property,
  value,
}: Omit<ObjectTableCellProps, "property"> & {
  property: Extract<PropertyDefinition, { kind: "enum" }>
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { clearStatus, commit, renderedValue, status } =
    useObjectTableCellCommit(value, onCommit, onEditingChange)
  const currentValue = objectTableCellInputValue(renderedValue)
  const choices =
    property.options ??
    property.values.map((option) => ({ label: option, value: option }))
  const currentLabel =
    choices.find((choice) => choice.value === currentValue)?.label ??
    currentValue

  useEffect(() => {
    if (editing) triggerRef.current?.focus()
  }, [editing])

  const displayValue =
    currentValue.length > 0 ? (
      <ObjectChoiceBadge
        choice={
          choices.find((choice) => choice.value === currentValue) ?? {
            label: currentLabel,
            value: currentValue,
          }
        }
      />
    ) : (
      <span className="text-muted-foreground/60">Empty</span>
    )

  if (!editing) {
    return (
      <ObjectTableCellSurface
        active={active}
        expandActive={expandActive}
        status={status}
        className="gap-1"
      >
        {displayValue}
      </ObjectTableCellSurface>
    )
  }

  return (
    <ObjectTableCellSurface
      active={active}
      expandActive={expandActive}
      status={status}
      className="p-0"
    >
      <div className="relative h-8 w-full">
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
            aria-label={property.label ?? "Cell value"}
            className="h-8 w-full rounded-none border-0 bg-transparent px-2 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0 [&>svg]:hidden"
            onKeyDown={(event) => {
              if (event.key === "Escape") onCancelEditing()
            }}
          >
            <SelectValue>{displayValue}</SelectValue>
          </SelectTrigger>
          <SelectContent align="start" alignItemWithTrigger={false}>
            {choices.map((choice) => (
              <SelectItem key={choice.value} value={choice.value}>
                {choice.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </ObjectTableCellSurface>
  )
}

function SelectCell(props: ObjectTableCellProps) {
  if (props.property.kind !== "enum") return null
  return <EnumSelectCell {...props} property={props.property} />
}

function BooleanCell({
  active,
  editing,
  expandActive,
  onCommit,
  onCancelEditing,
  onEditingChange,
  property,
  value,
}: ObjectTableCellProps) {
  const checkboxRef = useRef<HTMLButtonElement>(null)
  const { commit, renderedValue, status } = useObjectTableCellCommit(
    value,
    onCommit,
    onEditingChange
  )
  const checked = renderedValue === true

  useEffect(() => {
    if (editing) checkboxRef.current?.focus()
  }, [editing])

  return (
    <ObjectTableCellSurface
      active={active}
      expandActive={expandActive}
      status={status}
      className="gap-2 pr-2"
    >
      <Checkbox
        ref={checkboxRef}
        aria-label={`${property.label ?? "Boolean value"}: ${checked ? "Yes" : "No"}`}
        checked={checked}
        disabled={onCommit === undefined}
        tabIndex={editing ? 0 : -1}
        onBlur={() => {
          if (editing) onEditingChange(false)
        }}
        onCheckedChange={(nextChecked) => void commit(nextChecked)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancelEditing()
        }}
      />
      <span className="sr-only">{checked ? "Yes" : "No"}</span>
    </ObjectTableCellSurface>
  )
}

function objectTableTagChoices(
  property: PropertyDefinition
): ReadonlyArray<Choice> {
  const schema = objectTablePropertySchema(property)
  if (schema.kind !== "array") return []
  const itemSchema = objectTablePropertySchema(schema.items)
  if (itemSchema.kind !== "enum") return []
  return (
    itemSchema.options ??
    itemSchema.values.map((value) => ({ label: value, value }))
  )
}

function TagsCell({
  active,
  editing,
  expandActive,
  onCommit,
  onCancelEditing,
  onEditingChange,
  property,
  value,
}: ObjectTableCellProps) {
  const searchRef = useRef<HTMLInputElement>(null)
  const { commit, renderedValue, status } = useObjectTableCellCommit(
    value,
    onCommit,
    onEditingChange
  )
  const values = Array.isArray(renderedValue) ? renderedValue : []
  const [draft, setDraft] = useState(values)
  const declaredChoices = objectTableTagChoices(property)
  const choices = [
    ...declaredChoices,
    ...values
      .filter(
        (item) => !declaredChoices.some((choice) => choice.value === item)
      )
      .map((item) => ({ label: item, value: item })),
  ]

  useEffect(() => {
    setDraft(Array.isArray(value) ? value : [])
  }, [value])

  useEffect(() => {
    if (!editing) return undefined
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [editing])

  const displayedValues = editing ? draft : values

  const display = (
    <ObjectTableCellSurface
      active={active}
      expandActive={expandActive}
      status={status}
      className={active && expandActive ? "content-start" : undefined}
    >
      <div
        className={cn(
          "flex min-w-0 gap-1",
          active && expandActive
            ? "flex-wrap content-start"
            : "w-full flex-nowrap overflow-hidden"
        )}
      >
        {displayedValues.length > 0 ? (
          displayedValues.map((item) => (
            <ObjectChoiceBadge
              key={item}
              choice={
                choices.find((choice) => choice.value === item) ?? {
                  label: item,
                  value: item,
                }
              }
            />
          ))
        ) : (
          <span className="text-muted-foreground/60">Empty</span>
        )}
      </div>
    </ObjectTableCellSurface>
  )

  return (
    <Popover
      open={editing}
      onOpenChange={(open) => {
        if (!open) onEditingChange(false)
      }}
    >
      <PopoverTrigger
        nativeButton={false}
        render={<div className="h-full w-full" />}
      >
        {display}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={0}
        className="w-72 gap-0 overflow-hidden p-0"
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === "Escape") onCancelEditing()
        }}
      >
        <Command>
          <CommandInput ref={searchRef} placeholder="Search options…" />
          <CommandList>
            <CommandEmpty>No matching options.</CommandEmpty>
            {choices.map((choice) => {
              const selected = draft.includes(choice.value)
              return (
                <CommandItem
                  key={choice.value}
                  data-checked={selected}
                  value={`${choice.label} ${choice.value}`}
                  onSelect={() => {
                    const nextDraft = selected
                      ? draft.filter((item) => item !== choice.value)
                      : [...draft, choice.value]
                    setDraft(nextDraft)
                    void commit(nextDraft, false)
                  }}
                >
                  <ObjectChoiceBadge choice={choice} />
                </CommandItem>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function TextLikeCell(props: ObjectTableCellProps) {
  return <TextCell {...props} type={objectTableCellType(props.property)} />
}

const objectTableCellRenderers = {
  boolean: BooleanCell,
  date: TextLikeCell,
  domain: TextLikeCell,
  email: TextLikeCell,
  enum: SelectCell,
  image: ImageCell,
  files: FileCell,
  number: TextLikeCell,
  phone: TextLikeCell,
  readonly: TextLikeCell,
  recordId: TextLikeCell,
  tags: TagsCell,
  text: TextLikeCell,
  timestamp: TextLikeCell,
  url: TextLikeCell,
} satisfies Record<ObjectTableCellType, ComponentType<ObjectTableCellProps>>

export function ObjectTableCell(props: ObjectTableCellProps) {
  const Renderer = objectTableCellRenderers[objectTableCellType(props.property)]
  return <Renderer {...props} />
}
