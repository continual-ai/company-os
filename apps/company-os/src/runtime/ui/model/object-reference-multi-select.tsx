import { useState } from "react"

import { ObjectRecordPill } from "#/runtime/ui/model/object-record-identity.tsx"
import {
  ObjectReferenceSelect,
  type ReferenceOption,
} from "#/runtime/ui/model/object-reference-select.tsx"

export function ObjectReferenceMultiSelect({
  ariaDescribedBy,
  id,
  invalid = false,
  name,
  referenceLabels,
  onBlur,
  onValueChange,
  typeId,
  value,
}: {
  readonly ariaDescribedBy?: string | undefined
  readonly id: string
  readonly invalid?: boolean
  readonly name: string
  readonly onBlur: () => void
  readonly onValueChange: (value: ReadonlyArray<string>) => void
  readonly referenceLabels?: ReadonlyMap<string, string> | undefined
  readonly typeId: string
  readonly value: ReadonlyArray<string>
}) {
  const [options, setOptions] = useState<ReadonlyMap<string, ReferenceOption>>(
    new Map()
  )

  const add = (target: string, option?: ReferenceOption) => {
    if (value.includes(target)) return
    if (option !== undefined) {
      setOptions((current) => new Map(current).set(option.id, option))
    }
    onValueChange([...value, target])
  }

  return (
    <div
      className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent p-1.5"
      aria-describedby={ariaDescribedBy}
      aria-invalid={invalid}
    >
      {value.map((target) => {
        const option = options.get(target)
        return (
          <ObjectRecordPill
            key={target}
            label={option?.label ?? referenceLabels?.get(target) ?? target}
            presentation={option?.presentation}
            onRemove={() =>
              onValueChange(value.filter((candidate) => candidate !== target))
            }
          />
        )
      })}
      <ObjectReferenceSelect
        appearance="inline"
        ariaDescribedBy={ariaDescribedBy}
        closeOnSelect={false}
        id={id}
        includeHiddenInput={false}
        invalid={invalid}
        name={name}
        placeholder="Link a record"
        selectedValues={value}
        typeId={typeId}
        value=""
        onBlur={onBlur}
        onValueChange={add}
      />
    </div>
  )
}
