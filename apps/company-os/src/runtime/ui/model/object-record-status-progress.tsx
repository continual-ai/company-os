import { Button } from "@company/ui/button"
import { cn } from "@company/ui/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@company/ui/select"
import { useLayoutEffect, useRef, useState } from "react"

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
  const containerRef = useRef<HTMLElement>(null)
  const [compact, setCompact] = useState(false)
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return undefined
    const labels = Array.from(
      container.querySelectorAll<HTMLElement>("[data-status-label]")
    )
    const measure = () => {
      const widths = labels.map((label) => label.getBoundingClientRect().width)
      // End labels align inward; middle labels are centered on their markers.
      const minimumGap = Math.max(
        32,
        ...widths
          .slice(1)
          .map(
            (width, index) =>
              (index === 0
                ? Math.max(0, widths[index]! - 12)
                : widths[index]! / 2) +
              (index === widths.length - 2
                ? Math.max(0, width - 12)
                : width / 2) +
              12
          )
      )
      const minimumWidth =
        widths.length < 2
          ? Math.max(24, widths[0] ?? 0)
          : 24 + minimumGap * (widths.length - 1)
      setCompact(container.clientWidth < minimumWidth)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    labels.forEach((label) => observer.observe(label))
    measure()
    return () => observer.disconnect()
  }, [object])

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
      ref={containerRef}
      aria-label={`${fieldLabel} progress`}
      aria-busy={pendingValue !== undefined}
      data-record-field={field}
      className={cn("min-w-0 text-xs", className)}
    >
      {currentIndex < 0 && !compact && (
        <p className="mb-2 text-muted-foreground">
          {fieldLabel}: {value || "Not set"}
        </p>
      )}
      {compact && (
        <div className="flex min-w-0 items-center justify-between gap-3">
          <span className="shrink-0 font-medium text-muted-foreground">
            {fieldLabel}
          </span>
          {editable ? (
            <Select
              value={currentIndex < 0 ? null : value}
              disabled={disabled || pendingValue !== undefined}
              onValueChange={(next) => {
                if (
                  next !== null &&
                  next !== value &&
                  !disabled &&
                  pendingValue === undefined
                )
                  onChange?.(field, next)
              }}
            >
              <SelectTrigger
                aria-label={fieldLabel}
                className="min-w-0 max-w-full"
              >
                <SelectValue placeholder={value || "Not set"}>
                  {choices[currentIndex]?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                {choices.map((choice) => (
                  <SelectItem key={choice.value} value={choice.value}>
                    {choice.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span
              className="min-w-0 truncate font-medium"
              title={choices[currentIndex]?.label ?? value}
            >
              {choices[currentIndex]?.label ?? (value || "Not set")}
            </span>
          )}
        </div>
      )}
      <div
        aria-hidden={compact || undefined}
        className={cn(
          "relative w-full",
          compact && "invisible h-0 overflow-hidden"
        )}
      >
        {choices.length > 1 && (
          <div
            aria-hidden="true"
            className="absolute top-4 inset-x-3 h-0.5 -translate-y-1/2 bg-border"
          >
            <div
              className="h-full bg-primary/50"
              style={{
                width: `${(Math.max(0, currentIndex) / (choices.length - 1)) * 100}%`,
              }}
            />
          </div>
        )}
        <ol className="flex justify-between">
          {choices.map((step, index) => {
            const current = index === currentIndex
            const stepClassName = cn(
              "relative z-10 flex h-14 w-6 flex-col items-center justify-start rounded-md border-0 p-0 pt-1 text-xs whitespace-nowrap",
              current
                ? "font-semibold text-primary"
                : index < currentIndex
                  ? "font-medium text-foreground"
                  : "font-medium text-muted-foreground"
            )
            const content = (
              <>
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums",
                    current
                      ? "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15"
                      : currentIndex > index
                        ? "border-primary/40 bg-background text-primary"
                        : "border-border bg-background text-muted-foreground"
                  )}
                >
                  {index + 1}
                </span>
                <span
                  data-status-label=""
                  title={step.label}
                  className={cn(
                    "absolute top-9 w-max max-w-32 truncate",
                    index === 0
                      ? "left-0"
                      : index === choices.length - 1
                        ? "right-0"
                        : "left-1/2 -translate-x-1/2"
                  )}
                >
                  {step.label}
                </span>
              </>
            )
            return (
              <li
                key={step.value}
                aria-current={current ? "step" : undefined}
                className="relative w-6 shrink-0"
              >
                {editable ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      stepClassName,
                      "hover:bg-transparent hover:text-primary disabled:opacity-100 active:not-aria-[haspopup]:translate-y-0"
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
      </div>
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
