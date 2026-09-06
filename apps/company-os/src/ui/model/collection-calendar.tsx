import { Button } from "@company/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@company/ui/components/dialog"
import { cn } from "@company/ui/lib/utils"
import { PlusIcon } from "lucide-react"
import { useState } from "react"

import {
  CollectionCard,
  CollectionDropZone,
  type CollectionPresentation,
} from "./collection-card"
import {
  addDays,
  calendarDay,
  dateFieldValue,
  dateLabel,
  type CollectionDateWindow,
} from "./collection-dates"
import type { ScheduleLayout } from "./collection-layout"
import type { ClientRecord } from "./object-client"
import type { ObjectFormInput } from "./object-form"

export function CollectionCalendar({
  presentation,
  records,
  layout,
  window,
  anchor,
  onCreate,
}: {
  presentation: CollectionPresentation
  records: ReadonlyArray<ClientRecord>
  layout: ScheduleLayout
  window: CollectionDateWindow
  anchor: string
  onCreate?: ((values: ObjectFormInput) => void) | undefined
}) {
  const [selection, setSelection] = useState({
    month: anchor.slice(0, 7),
    day: anchor,
  })
  const [expandedDay, setExpandedDay] = useState<string>()
  const activeDay =
    selection.month === anchor.slice(0, 7) ? selection.day : anchor
  const today = new Date().toISOString().slice(0, 10)
  const days = Array.from({ length: 42 }, (_, index) =>
    addDays(window.first, index)
  )
  const scheduled = records.filter(
    (record) => calendarDay(record[layout.start]) !== undefined
  )
  const onDay = (day: string) =>
    scheduled.filter((record) => {
      const start = calendarDay(record[layout.start])!
      const end =
        layout.end === undefined
          ? start
          : (calendarDay(record[layout.end]) ?? start)
      return start <= day && day <= (end < start ? start : end)
    })
  const create = (day: string) =>
    onCreate?.({
      [layout.start]: dateFieldValue(presentation.object, layout.start, day),
      ...(layout.end === undefined
        ? {}
        : {
            [layout.end]: dateFieldValue(presentation.object, layout.end, day),
          }),
    })
  return (
    <>
      <div className="hidden @3xl/collection:block">
        <div className="grid grid-cols-7 border-b bg-muted/25 text-center text-xs font-medium text-muted-foreground">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div key={day} className="py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => (
            <CollectionDropZone
              key={day}
              id={`day:${day}`}
              value={day}
              className={cn(
                "min-h-32 min-w-0 border-r border-b p-1.5",
                !day.startsWith(anchor.slice(0, 7)) && "bg-muted/35"
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full text-xs",
                    day === today &&
                      "bg-primary font-semibold text-primary-foreground"
                  )}
                >
                  {Number(day.slice(-2))}
                </span>
                {onCreate && (
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Create on ${dateLabel(day)}`}
                    onClick={() => create(day)}
                  >
                    <PlusIcon />
                  </Button>
                )}
              </div>
              <div className="space-y-1">
                {onDay(day)
                  .slice(0, 3)
                  .map((record) => (
                    <CollectionCard
                      key={record.id}
                      anchor={day}
                      occurrence={day}
                      compact
                      record={record}
                      presentation={presentation}
                    />
                  ))}
                {onDay(day).length > 3 && (
                  <button
                    type="button"
                    className="w-full rounded px-1 py-1 text-left text-xs font-medium text-muted-foreground hover:bg-muted"
                    onClick={() => setExpandedDay(day)}
                  >
                    +{onDay(day).length - 3} more
                  </button>
                )}
              </div>
            </CollectionDropZone>
          ))}
        </div>
      </div>
      <div className="@3xl/collection:hidden">
        <div className="grid grid-cols-7 border-b p-2">
          {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
            <span
              key={index}
              className="py-2 text-center text-xs text-muted-foreground"
            >
              {day}
            </span>
          ))}
          {days.map((day) => (
            <CollectionDropZone key={day} id={`mobile-day:${day}`} value={day}>
              <button
                type="button"
                aria-label={dateLabel(day, { month: "long", day: "numeric" })}
                aria-pressed={day === activeDay}
                onClick={() => setSelection({ month: anchor.slice(0, 7), day })}
                className={cn(
                  "flex h-11 w-full flex-col items-center justify-center gap-1 rounded-lg text-sm",
                  !day.startsWith(anchor.slice(0, 7)) &&
                    "text-muted-foreground/50",
                  day === activeDay
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                {Number(day.slice(-2))}
                <span
                  className={cn(
                    "size-1 rounded-full",
                    onDay(day).length > 0 ? "bg-current" : "bg-transparent"
                  )}
                />
              </button>
            </CollectionDropZone>
          ))}
        </div>
        <section className="space-y-3 p-4">
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              {dateLabel(activeDay, {
                month: "long",
                day: "numeric",
                weekday: "short",
              })}
            </h3>
            {onCreate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => create(activeDay)}
              >
                <PlusIcon />
                Add
              </Button>
            )}
          </header>
          {onDay(activeDay).map((record) => (
            <CollectionCard
              key={record.id}
              anchor={activeDay}
              occurrence="agenda"
              record={record}
              presentation={presentation}
            />
          ))}
          {onDay(activeDay).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing scheduled for this day.
            </p>
          )}
        </section>
      </div>
      <Dialog
        open={expandedDay !== undefined}
        onOpenChange={(open) => {
          if (!open) setExpandedDay(undefined)
        }}
      >
        <DialogContent className="max-h-[85svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {expandedDay === undefined
                ? "Scheduled records"
                : dateLabel(expandedDay, {
                    month: "long",
                    day: "numeric",
                    weekday: "long",
                  })}
            </DialogTitle>
          </DialogHeader>
          {expandedDay !== undefined &&
            onDay(expandedDay).map((record) => (
              <CollectionCard
                key={record.id}
                occurrence="expanded"
                record={record}
                presentation={{ ...presentation, canMove: () => false }}
              />
            ))}
        </DialogContent>
      </Dialog>
    </>
  )
}
