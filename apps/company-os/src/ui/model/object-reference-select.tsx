import { modelTypeAccepts, type ListRequest } from "@company/runtime"
import { Button } from "@company/ui/components/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@company/ui/components/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@company/ui/components/popover"
import { cn } from "@company/ui/lib/utils"
import { Model } from "company-os/model"
import { Effect } from "effect"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { ROOT_ID } from "@/system-records"
import { useModelQuery } from "@/use-model-query"

import {
  clientFor,
  modelObjectProperty,
  recordLabel,
  recordObjectTypes,
  tableRecord,
  type ModelObject,
  type ObjectRecordPresentation,
} from "./object-client"
import { canSortProperty } from "./object-collection-query"
import { useObjectCreate } from "./object-create-context"
import { ObjectRecordOption } from "./object-record-identity"
import { ObjectReferenceCreateActions } from "./object-reference-create-actions"

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
  typeId: string,
  query: string,
  constraints: ReadonlyArray<ReferenceConstraint>
): Effect.Effect<ReadonlyArray<ReferenceOption>, unknown> {
  return Effect.gen(function* () {
    const normalizedQuery = query.trim()
    const pages = yield* Effect.forEach(
      recordObjectTypes(typeId),
      (object) =>
        Effect.gen(function* () {
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
            // SAFETY: the selected title property is a sortable portable field.
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion
            request.sort = sort as Exclude<ListRequest["sort"], undefined>
          }
          return {
            object,
            page: yield* clientFor(object).list(request),
          }
        }),
      { concurrency: "unbounded" }
    )
    const options: ReferenceOption[] = pages.flatMap(({ object, page }) =>
      page.items.map((record) => ({
        id: record.id,
        label: recordLabel(object, record),
        presentation: { object, record: tableRecord(object, record) },
      }))
    )
    if (modelTypeAccepts(Model, Model.root.id, typeId)) {
      options.unshift({ id: ROOT_ID, label: Model.root.name })
    }
    return options
  })
}

export function ObjectReferenceSelect({
  appearance = "field",
  ariaDescribedBy,
  closeOnSelect = true,
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
  readonly appearance?: "field" | "inline"
  readonly ariaDescribedBy?: string | undefined
  readonly closeOnSelect?: boolean
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
  const openObjectCreate = useObjectCreate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selection, setSelection] = useState<ReferenceOption>()
  const optionsQuery = useMemo(
    () =>
      open
        ? findOptions(typeId, query, constraints).pipe(
            Effect.delay("150 millis")
          )
        : Effect.succeed([]),
    [open, typeId, query, constraints]
  )
  const result = useModelQuery(optionsQuery)
  const options = result.value ?? []
  const loading = result.loading
  const error =
    result.error === undefined
      ? undefined
      : result.error instanceof Error
        ? result.error.message
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
                appearance === "field"
                  ? "w-full justify-between border-input bg-transparent font-normal hover:bg-transparent"
                  : "h-7 min-w-36 flex-1 justify-between border-0 bg-transparent px-2 font-normal text-muted-foreground shadow-none hover:bg-muted/60 hover:text-foreground"
              )}
              onBlur={onBlur}
            />
          }
        >
          {selected === undefined ? (
            <span className="truncate">{initialLabel ?? placeholder}</span>
          ) : (
            <ObjectRecordOption
              label={selected.label}
              presentation={selected.presentation}
            />
          )}
          <ChevronDownIcon className="text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 gap-0 p-0">
          <Command shouldFilter={false}>
            <CommandInput
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
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
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
          <ObjectReferenceCreateActions typeId={typeId} onCreate={create} />
        </PopoverContent>
      </Popover>
    </>
  )
}

export interface ReferenceConstraint {
  readonly field: string
  readonly value: boolean | number | string
}
