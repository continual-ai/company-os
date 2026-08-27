import { Button } from "@company/ui/components/button"
import { XIcon } from "lucide-react"
import { useState } from "react"

import {
  ObjectReferenceSelect,
  type ReferenceOption,
} from "./object-reference-select"

export function ObjectReferenceMultiSelect({
  ariaDescribedBy,
  id,
  invalid = false,
  name,
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
  readonly typeId: string
  readonly value: ReadonlyArray<string>
}) {
  const [labels, setLabels] = useState<ReadonlyMap<string, string>>(new Map())

  const add = (target: string, option?: ReferenceOption) => {
    if (value.includes(target)) return
    if (option !== undefined) {
      setLabels((current) => new Map(current).set(option.id, option.label))
    }
    onValueChange([...value, target])
  }

  return (
    <div
      className="grid gap-2"
      aria-describedby={ariaDescribedBy}
      aria-invalid={invalid}
    >
      {value.length === 0 ? null : (
        <div className="flex flex-wrap gap-1.5">
          {value.map((target) => (
            <span
              key={target}
              className="inline-flex min-w-0 items-center gap-1 border bg-muted px-2 py-1 text-xs"
            >
              <span className="max-w-56 truncate">
                {labels.get(target) ?? target}
              </span>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={`Remove ${labels.get(target) ?? target}`}
                onClick={() =>
                  onValueChange(
                    value.filter((candidate) => candidate !== target)
                  )
                }
              >
                <XIcon />
              </Button>
            </span>
          ))}
        </div>
      )}
      <ObjectReferenceSelect
        ariaDescribedBy={ariaDescribedBy}
        id={id}
        includeHiddenInput={false}
        invalid={invalid}
        name={name}
        placeholder="Add a record"
        typeId={typeId}
        value=""
        onBlur={onBlur}
        onValueChange={add}
      />
    </div>
  )
}
