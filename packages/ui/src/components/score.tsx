import { useId, type ComponentProps } from "react"

import { Input } from "#/components/input.tsx"
import { Slider } from "#/components/slider.tsx"
import { cn } from "#/lib/utils.ts"

const tones = {
  low: "text-rose-500 dark:text-rose-400",
  medium: "text-amber-500 dark:text-amber-400",
  high: "text-emerald-500 dark:text-emerald-400",
}

function scoreFraction(value: number, min: number, max: number) {
  return Math.max(0, Math.min(1, (value - min) / (max - min)))
}

function scoreTone(fraction: number) {
  return fraction >= 0.8 ? "high" : fraction >= 0.55 ? "medium" : "low"
}

/** Compact, noninteractive score. The number remains authoritative; bars summarize it. */
function Score({
  value,
  min = 0,
  max = 100,
  label = "Score",
  className,
}: {
  value: number | null
  min?: number | undefined
  max?: number | undefined
  label?: string | undefined
  className?: string | undefined
}) {
  const valid = value !== null && Number.isFinite(value)
  const fraction = valid ? scoreFraction(value, min, max) : 0
  const filled = fraction === 0 ? 0 : Math.max(1, Math.round(fraction * 5))
  return (
    <span
      data-slot="score"
      data-tone={valid ? scoreTone(fraction) : undefined}
      role={valid ? "meter" : undefined}
      aria-label={label}
      aria-valuemin={valid ? min : undefined}
      aria-valuemax={valid ? max : undefined}
      aria-valuenow={valid ? value : undefined}
      className={cn("inline-flex min-w-0 items-center gap-2", className)}
    >
      <span
        aria-hidden="true"
        className={cn("flex w-20 shrink-0 gap-0.5", tones[scoreTone(fraction)])}
      >
        {Array.from({ length: 5 }, (_, index) => (
          <span
            key={index}
            data-filled={index < filled}
            className="h-1.5 min-w-0 flex-1 rounded-[1px] bg-muted data-[filled=true]:bg-current"
          />
        ))}
      </span>
      <span className="min-w-10 text-right text-xs tabular-nums text-muted-foreground">
        {valid ? value : "Empty"}
      </span>
    </span>
  )
}

type ScoreInputProps = Omit<
  ComponentProps<"input">,
  | "value"
  | "defaultValue"
  | "onChange"
  | "onBlur"
  | "type"
  | "min"
  | "max"
  | "step"
  | "size"
> & {
  value: string
  onValueChange: (value: string) => void
  onBlur?: (() => void) | undefined
  label?: string | undefined
  min?: number | undefined
  max?: number | undefined
}

/** Keep the draft as text so empty and invalid input can be validated by its form. */
function ScoreInput({
  value,
  onValueChange,
  label = "Score",
  min = 0,
  max = 100,
  className,
  disabled,
  readOnly,
  onBlur,
  ...props
}: ScoreInputProps) {
  const labelId = useId()
  const numeric = value.trim() === "" ? null : Number(value)
  const valid = numeric !== null && Number.isFinite(numeric)
  const fraction = valid ? scoreFraction(numeric, min, max) : 0
  return (
    <div
      data-slot="score-input"
      className={cn("min-w-0 space-y-3", className)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onBlur?.()
      }}
    >
      <span id={labelId} className="sr-only">
        {label}
      </span>
      <div className="flex items-center gap-4">
        <Slider
          aria-label={label}
          aria-labelledby={labelId}
          value={[valid ? Math.min(max, Math.max(min, numeric)) : min]}
          min={min}
          max={max}
          step={1}
          disabled={disabled || readOnly}
          className={cn(
            "flex-1 [&_[data-slot=slider-range]]:bg-current [&_[data-slot=slider-thumb]]:rounded-full [&_[data-slot=slider-thumb]]:border-current",
            tones[scoreTone(fraction)]
          )}
          onValueChange={(next) =>
            onValueChange(String(Array.isArray(next) ? next[0] : next))
          }
        />
        <Input
          {...props}
          type="number"
          aria-label={props["aria-label"] ?? label}
          value={value}
          min={min}
          max={max}
          step={1}
          disabled={disabled}
          readOnly={readOnly}
          className="w-20 shrink-0 text-right tabular-nums"
          onChange={(event) => onValueChange(event.currentTarget.value)}
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{min}</span>
        <Score
          value={valid ? numeric : null}
          min={min}
          max={max}
          label={`${label} preview`}
        />
        <span>{max}</span>
      </div>
    </div>
  )
}

export { Score, ScoreInput }
