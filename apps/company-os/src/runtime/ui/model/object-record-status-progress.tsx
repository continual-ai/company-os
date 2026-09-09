import { cn } from "@company/ui/lib/utils"
import { CheckIcon } from "lucide-react"

import { ObjectChoiceBadge } from "#/runtime/ui/model/object-choice-badge.tsx"
import {
  modelObjectProperty,
  type ObjectRecordPresentation,
} from "#/runtime/ui/model/object-client.ts"
import { objectTablePropertySchema } from "#/runtime/ui/model/object-table/object-table-cell-types.ts"
import { objectTableValueText } from "#/runtime/ui/model/object-table/object-table-config.ts"

export function ObjectRecordStatusProgress({
  className,
  object,
  record,
}: ObjectRecordPresentation & {
  readonly className?: string | undefined
}) {
  const statusPropertyId = object.display.status
  if (statusPropertyId === undefined) return null

  const property = modelObjectProperty(object, statusPropertyId)
  if (property === undefined) return null

  const propertySchema = objectTablePropertySchema(property)
  if (propertySchema.kind !== "enum") return null

  const choices =
    propertySchema.options ??
    propertySchema.values.map((value) => ({ label: value, value }))
  const currentValue = objectTableValueText(record[statusPropertyId])
  const currentIndex = choices.findIndex(
    (choice) => choice.value === currentValue
  )
  if (currentIndex < 0 || choices.length < 2) return null

  const currentChoice = choices[currentIndex]!

  return (
    <section
      aria-label={`${object.name} status progress`}
      className={cn("max-w-full overflow-x-auto", className)}
      data-record-status-progress=""
    >
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Status</span>
        <ObjectChoiceBadge choice={currentChoice} />
      </div>
      <ol className="flex min-w-max items-start">
        {choices.map((choice, index) => {
          const complete = index < currentIndex
          const current = index === currentIndex

          return (
            <li
              key={choice.value}
              aria-current={current ? "step" : undefined}
              className="flex items-start"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                    complete || current
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-muted-foreground"
                  )}
                >
                  {complete ? <CheckIcon className="size-3" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "max-w-32 truncate text-xs",
                    current
                      ? "font-semibold text-foreground"
                      : complete
                        ? "text-foreground"
                        : "text-muted-foreground"
                  )}
                >
                  {choice.label}
                </span>
              </div>
              {index < choices.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mx-2 mt-2.5 h-px w-8",
                    index < currentIndex ? "bg-foreground" : "bg-border"
                  )}
                />
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
