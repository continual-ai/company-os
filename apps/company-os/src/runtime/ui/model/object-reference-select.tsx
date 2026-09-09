import { Button } from "@company/ui/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@company/ui/command"
import { cn } from "@company/ui/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@company/ui/popover"
import { useQueries } from "@tanstack/react-query"
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { modelTypeAccepts, type ListRequest } from "#/runtime/model/index.ts"
import { ROOT_ID } from "#/runtime/model/system-records.ts"
import {
  clientFor,
  modelObjectProperty,
  recordLabel,
  recordObjectTypes,
  tableRecord,
  type ModelObject,
  type ObjectRecordPresentation,
} from "#/runtime/ui/model/object-client.ts"
import { canSortProperty } from "#/runtime/ui/model/object-collection-query.ts"
import { useObjectCreate } from "#/runtime/ui/model/object-create-context.ts"
import { ObjectRecordOption } from "#/runtime/ui/model/object-record-identity.tsx"
import { ObjectReferenceCreateActions } from "#/runtime/ui/model/object-reference-create-actions.tsx"
import {
  type ModelUiRuntime,
  useModelRuntime,
} from "#/runtime/ui/model/runtime-context.tsx"

export interface ReferenceOption {
  readonly id: string
  readonly label: string
  readonly presentation?: ObjectRecordPresentation | undefined
}

const noConstraints: ReadonlyArray<ReferenceConstraint> = []
const noSelectedValues: ReadonlyArray<string> = []

interface ReferenceListRequest {
  filter?: Exclude<ListRequest["filter"], undefined>
  pageSize: number
  sort?: Exclude<ListRequest["sort"], undefined>
}

function findOptions(
  runtime: ModelUiRuntime,
  typeId: string,
  query: string,
  constraints: ReadonlyArray<ReferenceConstraint>
) {
  const normalizedQuery = query.trim()
  return recordObjectTypes(runtime, typeId).map((object) => {
    const title = object.display.title
    const titleProperty = modelObjectProperty(object, title)
    const titleFilter =
      normalizedQuery !== "" && titleProperty?.kind === "string"
        ? {
            field: title,
            operator: "contains" as const,
            value: normalizedQuery,
          }
        : undefined
    const filters = [
      ...constraints.map((constraint) => ({
        field: constraint.field,
        operator: "eq" as const,
        value: constraint.value,
      })),
      ...(titleFilter === undefined ? [] : [titleFilter]),
    ]
    const filter =
      filters.length === 0
        ? undefined
        : filters.length === 1
          ? filters[0]!
          : { and: filters }
    const sort =
      titleProperty !== undefined && canSortProperty(titleProperty)
        ? [
            {
              direction: "asc" as const,
              field: title,
              nulls: "last" as const,
            },
          ]
        : undefined
    const request: ReferenceListRequest = { pageSize: 20 }
    if (filter !== undefined) {
      request.filter = filter
    }
    if (sort !== undefined) {
      request.sort = sort
    }
    return { object, query: clientFor(runtime, object).list(request) }
  })
}

export function ObjectReferenceSelect({
  appearance = "field",
  allowCreate = true,
  ariaDescribedBy,
  closeOnSelect = true,
  clearable,
  constraints = noConstraints,
  disabled = false,
  id,
  includeHiddenInput = true,
  initialLabel,
  invalid = false,
  name,
  onBlur,
  onValueChange,
  placeholder = "Select a record",
  required = false,
  selectedValues = noSelectedValues,
  typeId,
  value,
}: {
  readonly allowCreate?: boolean
  readonly appearance?: "field" | "inline" | "action"
  readonly ariaDescribedBy?: string | undefined
  readonly closeOnSelect?: boolean
  readonly clearable?: boolean
  readonly disabled?: boolean
  readonly id?: string | undefined
  readonly includeHiddenInput?: boolean
  readonly constraints?: ReadonlyArray<ReferenceConstraint>
  readonly initialLabel?: string | undefined
  readonly invalid?: boolean | undefined
  readonly name: string
  readonly onBlur: () => void
  readonly onValueChange: (value: string, option?: ReferenceOption) => void
  readonly placeholder?: string
  readonly required?: boolean
  readonly selectedValues?: ReadonlyArray<string>
  readonly typeId: string
  readonly value: string
}) {
  const runtime = useModelRuntime()

  const openObjectCreate = useObjectCreate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selection, setSelection] = useState<ReferenceOption>()
  const [search, setSearch] = useState("")
  const searchInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 150)
    return () => clearTimeout(timer)
  }, [query])
  const requests = findOptions(runtime, typeId, search, constraints)
  const results = useQueries({
    queries: requests.map(({ query: options }) => ({
      ...options,
      enabled: open,
    })),
  })
  const options: ReferenceOption[] = results.flatMap((result, index) => {
    const object = requests[index]!.object
    return (result.data?.items ?? []).map((record) => ({
      id: record.id,
      label: recordLabel(object, record),
      presentation: { object, record: tableRecord(object, record) },
    }))
  })
  if (modelTypeAccepts(runtime.model, runtime.model.root.id, typeId))
    options.unshift({ id: ROOT_ID, label: runtime.model.root.name })
  const loading =
    results.some((result) => result.isFetching) || search !== query
  const cause = results.find((result) => result.error !== null)?.error
  const error =
    cause === null || cause === undefined
      ? undefined
      : cause instanceof Error
        ? cause.message
        : "References could not be loaded."
  const selected =
    options.find((option) => option.id === value) ??
    (selection?.id === value ? selection : undefined)

  const create = (object: ModelObject) => {
    setOpen(false)
    openObjectCreate(object, {
      onCreated: (record) => {
        const option = {
          id: record.id,
          label: recordLabel(object, record),
          presentation: { object, record: tableRecord(object, record) },
        }
        setSelection(option)
        onValueChange(option.id, option)
      },
    })
  }

  return (
    <>
      {includeHiddenInput ? (
        <input type="hidden" name={name} value={value} />
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              id={id}
              variant="outline"
              disabled={disabled}
              aria-describedby={ariaDescribedBy}
              aria-invalid={invalid}
              aria-required={required}
              data-form-field={name}
              className={cn(
                appearance === "action"
                  ? "h-8 bg-muted/50"
                  : appearance === "field"
                    ? "w-full justify-between border-input bg-transparent font-normal hover:bg-transparent"
                    : "h-7 min-w-36 flex-1 justify-between border-0 bg-transparent px-2 font-normal text-muted-foreground shadow-none hover:bg-muted/60 hover:text-foreground"
              )}
              onBlur={onBlur}
              onKeyDown={(event) => {
                if (
                  event.ctrlKey ||
                  event.metaKey ||
                  event.altKey ||
                  event.nativeEvent.isComposing
                )
                  return
                if (event.key === "ArrowDown") {
                  event.preventDefault()
                  setOpen(true)
                } else if (event.key.length === 1 && event.key !== " ") {
                  event.preventDefault()
                  setQuery((current) =>
                    open ? current + event.key : event.key
                  )
                  setOpen(true)
                }
              }}
            />
          }
        >
          {selected === undefined || appearance === "action" ? (
            <span className="truncate">{initialLabel ?? placeholder}</span>
          ) : (
            <ObjectRecordOption
              label={selected.label}
              presentation={selected.presentation}
            />
          )}
          <ChevronDownIcon className="text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          initialFocus={searchInput}
          className="w-80 max-w-[calc(100vw-2rem)] gap-0 p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              ref={searchInput}
              placeholder="Search records…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>
                {loading
                  ? "Loading…"
                  : error === undefined
                    ? "No matching records"
                    : error}
              </CommandEmpty>
              {(clearable ?? !required) &&
                value !== "" &&
                appearance !== "action" && (
                  <CommandItem
                    value="__clear_selection"
                    onSelect={() => {
                      setSelection(undefined)
                      onValueChange("")
                      setOpen(false)
                    }}
                  >
                    <XIcon className="text-muted-foreground" />
                    Clear selection
                  </CommandItem>
                )}
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  disabled={selectedValues.includes(option.id)}
                  onSelect={() => {
                    if (selectedValues.includes(option.id)) return
                    setSelection(option)
                    onValueChange(option.id, option)
                    if (closeOnSelect) {
                      setOpen(false)
                    } else {
                      setQuery("")
                    }
                  }}
                >
                  <ObjectRecordOption
                    label={option.label}
                    presentation={option.presentation}
                  />
                  {option.id === value || selectedValues.includes(option.id) ? (
                    <CheckIcon className="ml-auto" />
                  ) : null}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
          {allowCreate && (
            <ObjectReferenceCreateActions typeId={typeId} onCreate={create} />
          )}
        </PopoverContent>
      </Popover>
    </>
  )
}

export interface ReferenceConstraint {
  readonly field: string
  readonly value: boolean | number | string
}
