import type {
  Choice,
  ChoiceColor,
  ObjectType,
  PropertyDefinition,
} from "@company/runtime"
import { Badge } from "@company/ui/components/badge"
import { Checkbox } from "@company/ui/components/checkbox"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@company/ui/components/command"
import { Input } from "@company/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@company/ui/components/popover"
import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from "@company/ui/components/preview-card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@company/ui/components/select"
import { cn } from "@company/ui/lib/utils"
import {
  FactoryIcon,
  ImageIcon,
  ShoppingBagIcon,
  TruckIcon,
} from "lucide-react"
import { type ComponentType, useEffect, useRef, useState } from "react"

import {
  formatObjectTableCellText,
  objectTableCellInputValue,
  useObjectTableCellCommit,
  type ObjectTableCellCommit,
  type ObjectTableCellEditingChange,
} from "./object-table-cell-state"
import {
  ObjectTableCellSurface,
  ObjectTableCellValidationMessage,
} from "./object-table-cell-surface"
import {
  objectTableCellType,
  objectTableInputType,
  objectTableLinkHref,
  objectTablePropertySchema,
  objectTableUrlDisplayValue,
  parseObjectTableCellInput,
  type ObjectTableCellType,
} from "./object-table-cell-types"
import {
  objectTableImageValue,
  type ObjectTableImageResolver,
  type ObjectTableRecord,
  type ObjectTableValue,
} from "./object-table-config"
import { ObjectTableIdentity } from "./object-table-identity"

const tagColorClasses = {
  blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
  gray: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300",
  green:
    "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300",
  indigo:
    "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  lime: "border-lime-200 bg-lime-50 text-lime-800 dark:border-lime-800 dark:bg-lime-950 dark:text-lime-300",
  orange:
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300",
  pink: "border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-800 dark:bg-pink-950 dark:text-pink-300",
  purple:
    "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300",
  red: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  teal: "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-300",
  violet:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300",
  yellow:
    "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
} satisfies Record<ChoiceColor, string>

const tagIconComponents = new Map([
  ["factory", FactoryIcon],
  ["shoppingBag", ShoppingBagIcon],
  ["truck", TruckIcon],
])

interface ObjectTableCellProps {
  active: boolean
  editing: boolean
  expandActive: boolean
  identity?:
    | {
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
  type,
  value,
}: ObjectTableCellProps & { type: ObjectTableCellType }) {
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
        <div className="relative h-7 w-full">
          <Input
            ref={inputRef}
            aria-label={property.label ?? "Cell value"}
            aria-invalid={validationError !== null}
            type={objectTableInputType(type)}
            className="h-7 border-0 bg-transparent px-2 pr-7 shadow-none focus-visible:border-0 focus-visible:ring-0"
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
      {identity !== undefined ? (
        <ObjectTableIdentity {...identity} resolveImageSrc={resolveImageSrc} />
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
  const src = image === null ? null : (resolveImageSrc?.(image) ?? null)
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

  if (!editing) {
    return (
      <ObjectTableCellSurface
        active={active}
        expandActive={expandActive}
        status={status}
        className="gap-1"
      >
        {currentValue.length > 0 ? (
          <Badge variant="secondary" className="h-5 px-1.5 font-normal">
            {currentLabel}
          </Badge>
        ) : (
          <span className="text-muted-foreground/60">Empty</span>
        )}
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
      <div className="relative h-7 w-full">
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
            className="h-7 w-full border-0 bg-transparent px-2 shadow-none focus-visible:border-0 focus-visible:ring-0"
            onKeyDown={(event) => {
              if (event.key === "Escape") onCancelEditing()
            }}
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

function ObjectTableTag({
  choice,
  className,
}: {
  choice: Choice
  className?: string | undefined
}) {
  const Icon =
    choice.icon === undefined ? undefined : tagIconComponents.get(choice.icon)

  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center border px-1.5 font-normal",
        choice.color === undefined
          ? "border-transparent bg-secondary text-secondary-foreground"
          : tagColorClasses[choice.color],
        className
      )}
    >
      {Icon === undefined ? null : (
        <Icon aria-hidden="true" className="mr-1 size-3" />
      )}
      <span className="truncate">{choice.label}</span>
    </span>
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

  const displayedValues = editing ? draft.slice(-1) : values
  const hiddenSelectionCount = editing
    ? Math.max(0, draft.length - displayedValues.length)
    : 0

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
        {hiddenSelectionCount > 0 ? (
          <span
            aria-label={`${hiddenSelectionCount} additional selected options`}
            className="inline-flex h-5 shrink-0 items-center border border-border/60 bg-muted px-1.5 text-muted-foreground"
          >
            +{hiddenSelectionCount}
          </span>
        ) : null}
        {displayedValues.length > 0 ? (
          displayedValues.map((item) => (
            <ObjectTableTag
              key={item}
              className={editing ? "max-w-full min-w-0 shrink" : undefined}
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
                  <ObjectTableTag choice={choice} />
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
