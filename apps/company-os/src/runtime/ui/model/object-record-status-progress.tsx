import { Button } from "@company/ui/button"
import { cn } from "@company/ui/lib/utils"
import { CheckIcon, LoaderCircleIcon } from "lucide-react"

import {
  modelObjectProperty,
  type ObjectRecordPresentation,
} from "#/runtime/ui/model/object-client.ts"
import { objectFormProperties } from "#/runtime/ui/model/object-form.ts"
import { objectTableValueText } from "#/runtime/ui/model/object-table/object-table-config.ts"

export function ObjectRecordStatusProgress({
  object,
  record,
  onChange,
  disabled,
  pendingValue,
  error,
  className,
}: ObjectRecordPresentation & {
  readonly onChange?: ((field: string, value: string) => void) | undefined
  readonly disabled?: boolean | undefined
  readonly pendingValue?: string | undefined
  readonly error?: string | undefined
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
  const currentIndex = choices.findIndex((choice) => choice.value === value)
  const editable =
    onChange !== undefined &&
    objectFormProperties(object, "edit").some((item) => item.id === field)
  const fieldLabel = property.label ?? field

  return (
    <section
      aria-label={`${fieldLabel} progress`}
      aria-busy={pendingValue !== undefined}
      data-record-field={field}
      className={cn("w-max min-w-0 text-xs", className)}
    >
      {currentIndex < 0 && (
        <p className="mb-2 text-muted-foreground">
          {fieldLabel}: {value || "Not set"}
        </p>
      )}
      <ol className="flex items-center">
        {choices.map((step, index) => {
          const current = index === currentIndex
          const pending = step.value === pendingValue
          const stepClassName = cn(
            "inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-transparent px-1.5 font-medium whitespace-nowrap",
            current ? "bg-muted text-foreground" : "text-muted-foreground"
          )
          const content = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] tabular-nums",
                  current
                    ? "border-foreground bg-foreground text-background"
                    : currentIndex > index
                      ? "border-foreground/50 text-foreground"
                      : "border-border text-muted-foreground"
                )}
              >
                {pending ? (
                  <LoaderCircleIcon className="size-3 animate-spin" />
                ) : current ? (
                  <CheckIcon className="size-3" />
                ) : (
                  index + 1
                )}
              </span>
              <span>{step.label}</span>
            </>
          )
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
                    "mx-2 h-px w-6 shrink-0",
                    currentIndex >= index ? "bg-foreground/60" : "bg-border"
                  )}
                />
              )}
              {editable ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    stepClassName,
                    "disabled:opacity-100 active:not-aria-[haspopup]:translate-y-0"
                  )}
                  aria-label={`Set ${fieldLabel.toLowerCase()} to ${step.label}`}
                  aria-pressed={current}
                  disabled={disabled || pendingValue !== undefined}
                  onClick={() => {
                    if (!current && !disabled && pendingValue === undefined)
                      onChange?.(field, step.value)
                  }}
                >
                  {content}
                </Button>
              ) : (
                <span className={stepClassName}>{content}</span>
              )}
            </li>
          )
        })}
      </ol>
      <output className="sr-only">
        {pendingValue !== undefined
          ? `Saving ${fieldLabel.toLowerCase()}…`
          : ""}
      </output>
      {error && (
        <p role="alert" className="mt-2 text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
