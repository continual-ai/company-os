import type { ModelLinkTraversal } from "@company/runtime"
import { Button } from "@company/ui/components/button"
import { XIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { FormLinkDeltaValue, FormValue } from "@/ui/forms/form-value"

import {
  describeReferences,
  linkClientFor,
  type ClientRecord,
  type DynamicLinkListInput,
  type ModelObject,
  type RelatedRecord,
} from "./object-client"
import { ObjectRecordPill } from "./object-record-identity"
import {
  ObjectReferenceSelect,
  type ReferenceOption,
} from "./object-reference-select"

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
  const client = useMemo(
    () => linkClientFor(object, traversal),
    [object, traversal]
  )
  const [current, setCurrent] = useState<ReadonlyArray<RelatedRecord>>([])
  const [addedOptions, setAddedOptions] = useState<
    ReadonlyMap<string, ReferenceOption>
  >(new Map())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string>()
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const requestId = useRef(0)
  const delta = linkDelta(value)

  const load = useCallback(
    async (pageToken?: string) => {
      const currentRequest = ++requestId.current
      setLoading(true)
      setLoadError(undefined)
      try {
        const pageSize = traversal.traversal.cardinality === "many" ? 50 : 1
        const request: DynamicLinkListInput =
          pageToken === undefined
            ? { id: record.id, pageSize }
            : { id: record.id, pageSize, pageToken }
        const page = await client.list(request)
        const described = await describeReferences(page.items)
        if (requestId.current !== currentRequest) return
        setCurrent((loaded) =>
          pageToken === undefined
            ? described
            : [
                ...loaded,
                ...described.filter(
                  ({ id: target }) =>
                    !loaded.some(({ id: existing }) => existing === target)
                ),
              ]
        )
        setNextPageToken(page.nextPageToken)
      } catch (cause) {
        if (requestId.current !== currentRequest) return
        setLoadError(
          cause instanceof Error
            ? cause.message
            : `${traversal.traversal.label} could not be loaded.`
        )
      } finally {
        if (requestId.current === currentRequest) setLoading(false)
      }
    },
    [
      client,
      record.id,
      traversal.traversal.cardinality,
      traversal.traversal.label,
    ]
  )

  useEffect(() => {
    void load()
    return () => {
      requestId.current += 1
    }
  }, [load])

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

  if (traversal.traversal.cardinality !== "many") {
    const original = current[0]
    const selected = added[0] ?? activeCurrent[0]
    const canClear = client.unlink !== undefined && selected !== undefined
    return (
      <div className="flex items-center gap-2">
        <ObjectReferenceSelect
          ariaDescribedBy={ariaDescribedBy}
          disabled={loading}
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
            setDelta(
              target === original?.id ? [] : [target],
              delta.remove.filter((candidate) => candidate !== target)
            )
          }}
        />
        {canClear ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Clear ${traversal.traversal.label.toLowerCase()}`}
            onClick={() =>
              setDelta([], original === undefined ? [] : [original.id])
            }
          >
            <XIcon />
          </Button>
        ) : null}
      </div>
    )
  }

  const visible = [
    ...activeCurrent,
    ...added.filter(({ id: target }) => !currentById.has(target)),
  ]
  return (
    <div
      className="flex min-h-9 flex-wrap items-center gap-1.5 border border-input bg-transparent p-1.5"
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
      {loadError === undefined ? null : (
        <div className="flex items-center justify-between gap-2 text-xs text-destructive">
          <span>{loadError}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void load()}
          >
            Retry
          </Button>
        </div>
      )}
      {nextPageToken === null ? null : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => void load(nextPageToken)}
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
