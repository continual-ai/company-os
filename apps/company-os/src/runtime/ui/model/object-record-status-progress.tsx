import { Button } from "@company/ui/button"
import { cn } from "@company/ui/lib/utils"
import { useLayoutEffect, useRef } from "react"

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
  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const statusValue =
    object.display.status === undefined
      ? undefined
      : record[object.display.status]
  useLayoutEffect(() => {
    const container = containerRef.current
    const track = trackRef.current
    if (!container || !track) return undefined
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
      track.style.minWidth = `${minimumWidth}px`
      const current = track.querySelector<HTMLElement>('[aria-current="step"]')
      if (current) {
        const marker = current.getBoundingClientRect()
        const viewport = container.getBoundingClientRect()
        // Scroll only this strip; do not move the record page or its other pane.
        container.scrollLeft +=
          marker.left +
          marker.width / 2 -
          viewport.left -
          container.clientWidth / 2
      }
    }
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    labels.forEach((label) => observer.observe(label))
    measure()
    return () => observer.disconnect()
  }, [object, record.id, statusValue])

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
      className={cn("min-w-0 text-xs", className)}
    >
      {currentIndex < 0 && (
        <p className="mb-2 text-muted-foreground">
          {fieldLabel}: {value || "Not set"}
        </p>
      )}
      <div
        ref={containerRef}
        className="no-scrollbar overflow-x-auto overscroll-x-contain p-1"
      >
        <div ref={trackRef} className="relative w-full">
          {choices.length > 1 && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-4 inset-x-3 h-px -translate-y-1/2"
            >
              {choices.slice(1).map((step, index) => (
                <span
                  key={step.value}
                  className={cn(
                    "absolute h-px rounded-full",
                    index < currentIndex ? "bg-primary/20" : "bg-border"
                  )}
                  style={{
                    left: `calc(${(index / (choices.length - 1)) * 100}% + 18px)`,
                    width: `max(0px, calc(${100 / (choices.length - 1)}% - 36px))`,
                  }}
                />
              ))}
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
                        ? "border-primary bg-primary text-primary-foreground ring-2 ring-primary/10"
                        : currentIndex > index
                          ? "border-primary/25 bg-background text-foreground"
                          : "border-border/60 bg-background text-muted-foreground"
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
