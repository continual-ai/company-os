import { useDraggable } from "@dnd-kit/react"
import { Link } from "@tanstack/react-router"
import {
  GripVerticalIcon,
  PlusIcon,
  MoveHorizontalIcon,
  PencilIcon,
} from "lucide-react"

import { Button } from "#/runtime/ui/components/button.tsx"
import { cn } from "#/runtime/ui/lib/utils.ts"
import {
  CollectionDropZone,
  type CollectionDragData,
  type CollectionPresentation,
} from "#/runtime/ui/model/collection-card.tsx"
import {
  addDays,
  calendarDay,
  dateFieldValue,
  dateLabel,
  daysBetween,
  type CollectionDateWindow,
} from "#/runtime/ui/model/collection-dates.ts"
import type { ScheduleLayout } from "#/runtime/ui/model/collection-layout.ts"
import {
  recordLabel,
  type ClientRecord,
} from "#/runtime/ui/model/object-client.ts"
import type { ObjectFormInput } from "#/runtime/ui/model/object-form.ts"
import { objectHref } from "#/runtime/ui/model/object-routing.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

const dayWidth = 36
export function CollectionGantt({
  presentation: p,
  records,
  layout,
  window,
  onCreate,
}: {
  presentation: CollectionPresentation
  records: ReadonlyArray<ClientRecord>
  layout: ScheduleLayout
  window: CollectionDateWindow
  onCreate?: ((values: ObjectFormInput) => void) | undefined
}) {
  const runtime = useModelRuntime()

  const scheduled = records.filter(
    (record) => calendarDay(record[layout.start]) !== undefined
  )
  const days = Array.from({ length: 42 }, (_, index) =>
    addDays(window.first, index)
  )
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div className="min-h-72 overflow-x-auto bg-background [--record-width:10rem] sm:[--record-width:15rem]">
      <div
        className="relative"
        style={{ width: `calc(var(--record-width) + ${42 * dayWidth}px)` }}
      >
        <div
          className="absolute top-0 right-0 bottom-0 grid"
          style={{
            width: days.length * dayWidth,
            gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
          }}
        >
          {days.map((day) => (
            <CollectionDropZone
              key={day}
              id={`gantt:${day}`}
              value={day}
              className={cn(
                "h-full min-w-0 border-r",
                [0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay()) &&
                  "bg-muted/35",
                day === today && "bg-primary/5"
              )}
            />
          ))}
        </div>
        <header className="relative flex h-14 border-b text-xs">
          <div className="sticky left-0 z-20 flex w-(--record-width) shrink-0 items-center border-r bg-background px-3 font-medium">
            {p.object.pluralName}
          </div>
          {days.map((day) => (
            <div
              key={day}
              style={{ width: dayWidth }}
              className="relative shrink-0 py-1.5 text-center"
            >
              <p className="text-[9px] text-muted-foreground uppercase">
                {dateLabel(day, { weekday: "short" }).slice(0, 1)}
              </p>
              {onCreate ? (
                <button
                  type="button"
                  className={cn(
                    "mx-auto mt-0.5 grid size-6 place-items-center rounded-full hover:bg-muted focus-visible:outline-ring",
                    day === today && "bg-primary text-primary-foreground"
                  )}
                  aria-label={`Create on ${dateLabel(day)}`}
                  onClick={() =>
                    onCreate({
                      [layout.start]: dateFieldValue(
                        p.object,
                        layout.start,
                        day
                      ),
                      ...(layout.end === undefined
                        ? {}
                        : {
                            [layout.end]: dateFieldValue(
                              p.object,
                              layout.end,
                              day
                            ),
                          }),
                    })
                  }
                >
                  {Number(day.slice(-2))}
                </button>
              ) : (
                <p className="mt-1">{Number(day.slice(-2))}</p>
              )}
            </div>
          ))}
        </header>
        {scheduled.map((record) => (
          <div key={record.id} className="relative flex h-14 border-b">
            <div className="sticky left-0 z-20 flex w-(--record-width) shrink-0 items-center gap-1 border-r bg-background px-3">
              <Link
                className="min-w-0 flex-1 truncate text-xs font-medium hover:underline"
                to={
                  p.recordHref?.(record.id) ??
                  objectHref(runtime, p.object, record.id)
                }
              >
                {recordLabel(p.object, record)}
              </Link>
              {p.canEdit(record) && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Edit ${recordLabel(p.object, record)}`}
                  onClick={() => p.onEdit(record)}
                >
                  <PencilIcon />
                </Button>
              )}
            </div>
            <div className="relative flex-1">
              <GanttBar
                record={record}
                presentation={p}
                layout={layout}
                window={window}
              />
            </div>
          </div>
        ))}
        {scheduled.length === 0 && (
          <div className="relative flex h-28">
            <p className="sticky left-0 w-(--record-width) bg-background p-4 text-sm text-muted-foreground">
              No scheduled records in this window.
            </p>
          </div>
        )}
        {onCreate && (
          <div className="relative border-b">
            <div className="sticky left-0 w-(--record-width) border-r bg-background p-2">
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => onCreate({})}
              >
                <PlusIcon />
                Add {p.object.name.toLowerCase()}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
function GanttBar({
  record,
  presentation: p,
  layout,
  window,
}: {
  record: ClientRecord
  presentation: CollectionPresentation
  layout: ScheduleLayout
  window: CollectionDateWindow
}) {
  const start = calendarDay(record[layout.start])!
  const { ref, handleRef, isDragging } = useDraggable<CollectionDragData>({
    id: record.id,
    data: { record, anchor: start < window.first ? window.first : start },
    disabled: !p.canMove(record),
  })
  const end =
    layout.end === undefined
      ? start
      : (calendarDay(record[layout.end]) ?? start)
  const left = Math.max(0, daysBetween(window.first, start))
  const right = Math.min(
    42,
    daysBetween(window.first, end < start ? start : end) + 1
  )
  if (right <= left) return null
  return (
    <div
      ref={ref}
      className={cn(
        "absolute top-2.5 z-10 flex h-9 items-center rounded-md border border-primary/25 bg-primary/15 text-primary shadow-xs",
        isDragging && "opacity-40"
      )}
      style={{
        left: left * dayWidth + 2,
        width: Math.max(dayWidth - 4, (right - left) * dayWidth - 4),
      }}
      title={`${recordLabel(p.object, record)} · ${dateLabel(start)} – ${dateLabel(end)}`}
    >
      {p.canMove(record) && (
        <button
          ref={handleRef}
          type="button"
          aria-label={`Move ${recordLabel(p.object, record)}`}
          className="cursor-grab touch-none rounded-sm p-1 focus-visible:outline-ring"
        >
          <GripVerticalIcon className="size-3" />
        </button>
      )}
      <span className="min-w-0 flex-1 truncate px-1 text-[11px] font-medium">
        {recordLabel(p.object, record)}
      </span>
      {p.canMove(record) && layout.end !== undefined && (
        <ResizeHandle record={record} />
      )}
    </div>
  )
}
function ResizeHandle({ record }: { record: ClientRecord }) {
  const { ref } = useDraggable<CollectionDragData>({
    id: `${record.id}:resize`,
    data: { record, resize: true },
  })
  return (
    <button
      ref={ref}
      type="button"
      aria-label="Resize end date"
      className="h-full cursor-ew-resize touch-none rounded-r px-0.5 hover:bg-primary/15 focus-visible:outline-ring"
    >
      <MoveHorizontalIcon className="size-3" />
    </button>
  )
}
