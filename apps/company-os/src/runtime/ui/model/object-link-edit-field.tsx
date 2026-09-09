import { useInfiniteQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { modelCollectionQuery } from "#/runtime/client/model-collection-query.ts"
import type { ModelLinkTraversal } from "#/runtime/model/index.ts"
import { Button } from "#/runtime/ui/components/button.tsx"
import type {
  FormLinkDeltaValue,
  FormValue,
} from "#/runtime/ui/model/form-value.ts"
import {
  describeReferences,
  linkClientFor,
  type ClientRecord,
  type ModelObject,
} from "#/runtime/ui/model/object-client.ts"
import { ObjectRecordPill } from "#/runtime/ui/model/object-record-identity.tsx"
import {
  ObjectReferenceSelect,
  type ReferenceOption,
} from "#/runtime/ui/model/object-reference-select.tsx"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

interface LinkDelta {
  readonly add: ReadonlyArray<string>
  readonly remove: ReadonlyArray<string>
}

function linkDelta(value: FormValue): LinkDelta {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { add: [], remove: [] }
  }
  return {
    add: "add" in value && Array.isArray(value.add) ? value.add : [],
    remove:
      "remove" in value && Array.isArray(value.remove) ? value.remove : [],
  }
}

function unique(values: ReadonlyArray<string>): ReadonlyArray<string> {
  return [...new Set(values)]
}

export function ObjectLinkEditField({
  ariaDescribedBy,
  id,
  invalid,
  name,
  object,
  onBlur,
  onValueChange,
  record,
  traversal,
  value,
}: {
  readonly ariaDescribedBy?: string | undefined
  readonly id: string
  readonly invalid: boolean
  readonly name: string
  readonly object: ModelObject
  readonly onBlur: () => void
  readonly onValueChange: (value: FormLinkDeltaValue) => void
  readonly record: ClientRecord
  readonly traversal: ModelLinkTraversal
  readonly value: FormValue
}) {
  const runtime = useModelRuntime()

  const client = useMemo(
    () => linkClientFor(runtime, object, traversal),
    [runtime, object, traversal]
  )
  const [addedOptions, setAddedOptions] = useState<
    ReadonlyMap<string, ReferenceOption>
  >(new Map())
  const page = useInfiniteQuery(
    modelCollectionQuery(
      (request) => client.list({ ...request, id: record.id }),
      { pageSize: traversal.traversal.cardinality === "many" ? 50 : 1 }
    )
  )
  const current = describeReferences(
    runtime,
    page.data?.pages.flatMap((result) => result.items) ?? []
  )
  const loading = page.isFetching
  const loadError = page.error?.message
  const delta = linkDelta(value)

  const setDelta = (
    add: ReadonlyArray<string>,
    remove: ReadonlyArray<string>
  ) => onValueChange({ add: unique(add), remove: unique(remove) })

  const remember = (option?: ReferenceOption) => {
    if (option === undefined) return
    setAddedOptions((options) => new Map(options).set(option.id, option))
  }

  const currentById = new Map(current.map((item) => [item.id, item]))
  const activeCurrent = current.filter(
    ({ id: target }) => !delta.remove.includes(target)
  )
  const added = delta.add.map((target) => {
    const option = addedOptions.get(target)
    const existing = currentById.get(target)
    return {
      id: target,
      label: option?.label ?? existing?.label ?? target,
      presentation: option?.presentation ?? existing?.presentation,
    }
  })

  const loadFailure =
    loadError === undefined ? null : (
      <div className="flex items-center justify-between gap-2 text-xs text-destructive">
        <span>{loadError}</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            void page.refetch()
          }}
        >
          Retry
        </Button>
      </div>
    )

  if (traversal.traversal.cardinality !== "many") {
    const original = current[0]
    const selected = added[0] ?? activeCurrent[0]
    return (
      <div className="grid gap-2">
        {loadFailure}
        <div className="flex items-center gap-2">
          <ObjectReferenceSelect
            clearable={
              client.unlink !== undefined &&
              traversal.traversal.cardinality !== "one"
            }
            ariaDescribedBy={ariaDescribedBy}
            disabled={loading || loadError !== undefined}
            id={id}
            includeHiddenInput={false}
            initialLabel={selected?.label}
            invalid={invalid}
            name={name}
            placeholder={loading ? "Loading…" : "Select a record"}
            required={traversal.traversal.cardinality === "one"}
            typeId={traversal.target.from.typeId}
            value={selected?.id ?? ""}
            onBlur={onBlur}
            onValueChange={(target, option) => {
              remember(option)
              if (target === "") {
                setDelta([], original === undefined ? [] : [original.id])
                return
              }
              setDelta(
                target === original?.id ? [] : [target],
                delta.remove.filter((candidate) => candidate !== target)
              )
            }}
          />
        </div>
      </div>
    )
  }

  const visible = [
    ...activeCurrent,
    ...added.filter(({ id: target }) => !currentById.has(target)),
  ]
  return (
    <div
      className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent p-1.5"
      aria-describedby={ariaDescribedBy}
      aria-invalid={invalid}
    >
      {visible.map((item) => (
        <ObjectRecordPill
          key={item.id}
          label={item.label}
          presentation={item.presentation}
          onRemove={
            client.unlink === undefined
              ? undefined
              : () =>
                  delta.add.includes(item.id)
                    ? setDelta(
                        delta.add.filter((target) => target !== item.id),
                        delta.remove
                      )
                    : setDelta(delta.add, [...delta.remove, item.id])
          }
        />
      ))}
      {loadFailure}
      {!page.hasNextPage ? null : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => {
            if (!page.isFetching)
              void page.fetchNextPage({ cancelRefetch: false })
          }}
        >
          {loading ? "Loading…" : "Load more"}
        </Button>
      )}
      <ObjectReferenceSelect
        appearance="inline"
        ariaDescribedBy={ariaDescribedBy}
        closeOnSelect={false}
        id={id}
        includeHiddenInput={false}
        invalid={invalid}
        name={name}
        placeholder="Add a record"
        selectedValues={visible.map(({ id: target }) => target)}
        typeId={traversal.target.from.typeId}
        value=""
        onBlur={onBlur}
        onValueChange={(target, option) => {
          remember(option)
          if (currentById.has(target)) {
            setDelta(
              delta.add,
              delta.remove.filter((candidate) => candidate !== target)
            )
            return
          }
          setDelta([...delta.add, target], delta.remove)
        }}
      />
    </div>
  )
}
