"use client"

import { Button } from "@company/ui/components/button"
import { Calendar } from "@company/ui/components/calendar"
import { Input } from "@company/ui/components/input"
import { Label } from "@company/ui/components/label"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@company/ui/components/popover"
import { cn } from "@company/ui/lib/utils"
import { format } from "date-fns"
import { CalendarIcon, XIcon } from "lucide-react"

export interface DateTimePickerProps {
  readonly "aria-describedby"?: string | undefined
  readonly "aria-invalid"?: boolean
  readonly className?: string
  readonly disabled?: boolean
  readonly id: string
  readonly onBlur?: () => void
  readonly onValueChange: (value: string) => void
  readonly required?: boolean
  /** A local date-time value in `YYYY-MM-DDTHH:mm` form. */
  readonly value: string
}

function localDateTimeValue(date: Date): string {
  const local = new Date(date.valueOf() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function parseLocalDateTime(value: string): Date | undefined {
  if (value === "") return undefined
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? undefined : date
}

/** A controlled date-and-time input composed from the shared calendar and input primitives. */
function DateTimePicker({
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": invalid,
  className,
  disabled,
  id,
  onBlur,
  onValueChange,
  required,
  value,
}: DateTimePickerProps) {
  const selected = parseLocalDateTime(value)

  function selectDate(date: Date | undefined) {
    if (date === undefined) return
    const time = selected ?? new Date()
    const next = new Date(date)
    next.setHours(time.getHours(), time.getMinutes(), 0, 0)
    onValueChange(localDateTimeValue(next))
  }

  function selectTime(timeValue: string) {
    if (!/^\d{2}:\d{2}$/.test(timeValue)) return
    const [hours = 0, minutes = 0] = timeValue.split(":").map(Number)
    const next = selected === undefined ? new Date() : new Date(selected)
    next.setHours(hours, minutes, 0, 0)
    onValueChange(localDateTimeValue(next))
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-describedby={ariaDescribedBy}
            aria-invalid={invalid}
            aria-required={required}
            onBlur={onBlur}
            className={cn(
              "w-full justify-start text-left font-normal",
              selected === undefined && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarIcon data-icon="inline-start" />
        {selected === undefined
          ? "Select date and time"
          : format(selected, "PPP p")}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <PopoverHeader className="sr-only">
          <PopoverTitle>Choose date and time</PopoverTitle>
        </PopoverHeader>
        <Calendar mode="single" selected={selected} onSelect={selectDate} />
        <div className="flex items-end gap-2 border-t p-2">
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor={`${id}-time`}>Time</Label>
            <Input
              id={`${id}-time`}
              type="time"
              step={60}
              disabled={disabled}
              value={selected === undefined ? "" : format(selected, "HH:mm")}
              onChange={(event) => selectTime(event.currentTarget.value)}
            />
          </div>
          {!required && selected !== undefined ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Clear date and time"
              onClick={() => onValueChange("")}
            >
              <XIcon />
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { DateTimePicker }
