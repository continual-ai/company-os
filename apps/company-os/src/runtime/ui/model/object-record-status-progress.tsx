import { Button } from "@company/ui/button"
import { cn } from "@company/ui/lib/utils"
import { ChevronDownIcon } from "lucide-react"

import { ObjectChoiceBadge } from "#/runtime/ui/model/object-choice-badge.tsx"
import {
  modelObjectProperty,
  type ObjectRecordPresentation,
} from "#/runtime/ui/model/object-client.ts"
import { objectFormProperties } from "#/runtime/ui/model/object-form.ts"
import { objectTableValueText } from "#/runtime/ui/model/object-table/object-table-config.ts"

export function ObjectRecordStatusProgress({
  object,
  record,
  onEdit,
  disabled,
  className,
}: ObjectRecordPresentation & {
  readonly onEdit?: ((field: string) => void) | undefined
  readonly disabled?: boolean | undefined
  readonly className?: string | undefined
}) {
  const field = object.display.status
  if (field === undefined) return null
  const property = modelObjectProperty(object, field)
  if (property?.kind !== "enum") return null

  const choices =
    property.options ??
    property.values.map((value) => ({ value, label: value }))
  const value = objectTableValueText(record[field])
  const currentChoice = choices.find((choice) => choice.value === value)
  const editable =
    onEdit &&
    objectFormProperties(object, "edit").some((item) => item.id === field)
  const fieldLabel = property.label ?? field
  const label =
    currentChoice?.label ?? (value || `No ${fieldLabel.toLowerCase()}`)
  const badge = (
    <ObjectChoiceBadge
      choice={currentChoice ?? { value, label }}
      className="max-w-64 rounded-md"
    />
  )

  const control = editable ? (
    <Button
      variant="ghost"
      size="xs"
      className="gap-1 px-1"
      aria-label={`Edit ${fieldLabel}: ${label}`}
      title={fieldLabel}
      disabled={disabled}
      onClick={() => onEdit(field)}
    >
      {badge}
      <ChevronDownIcon className="size-3 text-muted-foreground" />
    </Button>
  ) : (
    <span aria-label={`${fieldLabel}: ${label}`}>{badge}</span>
  )
  if (choices.length < 2)
    return (
      <span data-record-field={field} className={cn("text-xs", className)}>
        {control}
      </span>
    )

  const currentIndex = choices.findIndex((choice) => choice.value === value)
  return (
    <section
      aria-label={`${fieldLabel} progress`}
      data-record-field={field}
      className={cn("flex w-max min-w-0 items-center gap-4 text-xs", className)}
    >
      {currentIndex < 0 && control}
      <ol className="flex items-center">
        {choices.map((step, index) => {
          const current = step.value === value
          const preceding = currentIndex > index
          return (
            <li
              key={step.value}
              aria-current={current ? "step" : undefined}
              className="flex items-center"
            >
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mx-3 h-px w-6",
                    currentIndex >= index ? "bg-foreground/30" : "bg-border"
                  )}
                />
              )}
              <span
                aria-hidden="true"
                className={cn(
                  "mr-1.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                  current
                    ? "border-foreground bg-foreground font-semibold text-background"
                    : preceding
                      ? "border-foreground/30 text-foreground"
                      : "border-border text-muted-foreground"
                )}
              >
                {index + 1}
              </span>
              {current ? (
                control
              ) : (
                <span
                  className={cn(
                    "whitespace-nowrap",
                    preceding ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
