import { Model } from "@company/model"
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
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { PLATFORM_ID } from "@/system-records"

import {
  clientFor,
  modelObjectProperty,
  recordLabel,
  recordObjectTypes,
} from "./object-client"
import { canSortProperty } from "./object-collection-query"

export interface ReferenceOption {
  readonly id: string
  readonly label: string
}

const noConstraints: ReadonlyArray<ReferenceConstraint> = []

interface ReferenceListRequest {
  filter?: Exclude<ListRequest["filter"], undefined>
  pageSize: number
  sort?: Exclude<ListRequest["sort"], undefined>
}

async function findOptions(
  typeId: string,
  query: string,
  constraints: ReadonlyArray<ReferenceConstraint>
): Promise<ReadonlyArray<ReferenceOption>> {
  const normalizedQuery = query.trim()
  const pages = await Promise.all(
    recordObjectTypes(typeId).map(async (object) => {
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
        page: await clientFor(object).list(request),
      }
    })
  )
  const options = pages.flatMap(({ object, page }) =>
    page.items.map((record) => ({
      id: record.id,
      label: recordLabel(object, record),
    }))
  )
  if (modelTypeAccepts(Model, Model.root.id, typeId)) {
    options.unshift({ id: PLATFORM_ID, label: Model.root.name })
  }
  return options
}

export function ObjectReferenceSelect({
  ariaDescribedBy,
  constraints = noConstraints,
  disabled = false,
  id,
  initialLabel,
  invalid = false,
  name,
  placeholder = "Select a record",
  required = false,
  typeId,
  value: initialValue = "",
}: {
  readonly ariaDescribedBy?: string | undefined
  readonly disabled?: boolean
  readonly id?: string | undefined
  readonly constraints?: ReadonlyArray<ReferenceConstraint>
  readonly initialLabel?: string | undefined
  readonly invalid?: boolean | undefined
  readonly name: string
  readonly placeholder?: string
  readonly required?: boolean
  readonly typeId: string
  readonly value?: string | undefined
}) {
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ReadonlyArray<ReferenceOption>>(
    initialValue === ""
      ? []
      : [{ id: initialValue, label: initialLabel ?? initialValue }]
  )
  const [query, setQuery] = useState("")
  const [value, setValue] = useState(initialValue)
  const [selectedLabel, setSelectedLabel] = useState(initialLabel)
  const inputRef = useRef<HTMLInputElement>(null)
  const requestId = useRef(0)

  useEffect(() => {
    if (!open) return undefined
    const currentRequest = ++requestId.current
    setLoading(true)
    setError(undefined)
    const timeout = window.setTimeout(() => {
      void findOptions(typeId, query, constraints)
        .then((loaded) => {
          if (requestId.current !== currentRequest) return
          setOptions(loaded)
        })
        .catch((cause: unknown) => {
          if (requestId.current !== currentRequest) return
          setError(
            cause instanceof Error
              ? cause.message
              : "References could not be loaded."
          )
        })
        .finally(() => {
          if (requestId.current === currentRequest) setLoading(false)
        })
    }, 150)
    return () => window.clearTimeout(timeout)
  }, [constraints, open, query, typeId])

  const selected = options.find((option) => option.id === value)

  return (
    <>
      <input ref={inputRef} type="hidden" name={name} value={value} />
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
              className="w-full justify-between font-normal"
            />
          }
        >
          <span className="truncate">
            {selected?.label ?? selectedLabel ?? placeholder}
          </span>
          <ChevronsUpDownIcon className="text-muted-foreground" />
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
                    setValue(option.id)
                    setSelectedLabel(option.label)
                    setOpen(false)
                    inputRef.current?.dispatchEvent(
                      new Event("input", { bubbles: true })
                    )
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {option.id === value ? (
                    <CheckIcon className="ml-auto" />
                  ) : null}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  )
}

export interface ReferenceConstraint {
  readonly field: string
  readonly value: boolean | number | string
}
