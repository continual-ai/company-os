import { DragDropProvider } from "@dnd-kit/react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useRef, useState } from "react"

import { Button } from "#/runtime/ui/components/button.tsx"
import { CollectionCalendar } from "#/runtime/ui/model/collection-calendar.tsx"
import {
  CollectionCard,
  CollectionDropZone,
  type CollectionDragData,
  type CollectionPresentation,
} from "#/runtime/ui/model/collection-card.tsx"
import {
  calendarDay,
  collectionDateWindow,
  dateLabel,
  scheduleChanges,
  shiftMonth,
} from "#/runtime/ui/model/collection-dates.ts"
import { CollectionGantt } from "#/runtime/ui/model/collection-gantt.tsx"
import { CollectionKanban } from "#/runtime/ui/model/collection-kanban.tsx"
import {
  collectionLayoutError,
  type CollectionLayout,
} from "#/runtime/ui/model/collection-layout.ts"
import {
  modelObjectProperty,
  type ClientRecord,
} from "#/runtime/ui/model/object-client.ts"
import type { ObjectFormInput } from "#/runtime/ui/model/object-form.ts"

export function CollectionVisual({
  presentation,
  records,
  layout,
  anchor,
  onDateChange,
  onUpdate,
  onCreate,
  loading,
}: {
  presentation: CollectionPresentation
  records: ReadonlyArray<ClientRecord>
  layout: Exclude<CollectionLayout, { type: "table" | "feed" }>
  anchor: string
  onDateChange: (day: string) => void
  onUpdate: (record: ClientRecord, changes: ObjectFormInput) => Promise<void>
  onCreate?: ((values: ObjectFormInput) => void) | undefined
  loading: boolean
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const dragged = useRef<CollectionDragData | undefined>(undefined)
  const layoutError = collectionLayoutError(presentation.object, layout)
  const fields =
    layout.type === "kanban"
      ? [layout.groupBy]
      : [layout.start, ...(layout.end === undefined ? [] : [layout.end])]
  const mutable = fields.every((id) => {
    const field = modelObjectProperty(presentation.object, id)
    return field !== undefined && !field.immutable && !field.outputOnly
  })
  const createInLayout = fields.every(
    (id) => modelObjectProperty(presentation.object, id)?.outputOnly === false
  )
    ? onCreate
    : undefined
  const canUnschedule =
    mutable &&
    fields.every((id) => modelObjectProperty(presentation.object, id)?.nullable)
  const p: CollectionPresentation = {
    ...presentation,
    canMove: (record) => !pending && mutable && presentation.canMove(record),
  }
  const window = collectionDateWindow(layout, anchor)
  const saveDrop = async (data: CollectionDragData, value: string | null) => {
    if (data.record === undefined || !p.canMove(data.record)) return
    if (layout.type !== "kanban" && value === null && !canUnschedule) return
    setError(undefined)
    setPending(true)
    try {
      const changes =
        layout.type === "kanban"
          ? { [layout.groupBy]: value }
          : scheduleChanges(p.object, layout, data.record, value, {
              resize: data.resize,
              anchor: data.anchor,
            })
      if (
        Object.entries(changes).some(
          ([field, next]) => data.record?.[field] !== next
        )
      )
        await onUpdate(data.record, changes)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The change could not be saved. Your record has not moved."
      )
    } finally {
      setPending(false)
    }
  }
  if (layoutError)
    return (
      <div role="alert" className="p-8 text-sm text-muted-foreground">
        {layoutError} Open the layout settings to change the field mapping.
      </div>
    )
  return (
    <div
      className="@container/collection flex min-h-0 flex-1 flex-col"
      aria-busy={pending || loading}
    >
      <output className="sr-only">
        {pending
          ? "Saving change…"
          : loading
            ? "Loading records…"
            : "Records ready"}
      </output>
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border-b bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(undefined)}>
            Dismiss
          </Button>
        </div>
      )}
      {layout.type !== "kanban" && (
        <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => onDateChange(shiftMonth(anchor, -1))}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next month"
            onClick={() => onDateChange(shiftMonth(anchor, 1))}
          >
            <ChevronRightIcon />
          </Button>
          <h2 className="min-w-36 flex-1 text-sm font-semibold">
            {dateLabel(anchor, { month: "long", year: "numeric" })}
          </h2>
          {fields.some((id) => {
            const field = modelObjectProperty(p.object, id)
            return field?.kind === "string" && field.format === "timestamp"
          }) && <span className="text-xs text-muted-foreground">UTC</span>}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDateChange(new Date().toISOString().slice(0, 10))}
          >
            Today
          </Button>
        </header>
      )}
      {loading && records.length === 0 ? (
        <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">
          Loading records…
        </div>
      ) : (
        <DragDropProvider<CollectionDragData>
          onDragStart={(event) => {
            dragged.current = event.operation.source?.data
          }}
          onDragEnd={(event) => {
            const data = dragged.current
            dragged.current = undefined
            const value = event.operation.target?.data.value
            if (!event.canceled && data && value !== undefined)
              void saveDrop(data, value)
          }}
        >
          {layout.type === "kanban" ? (
            <CollectionKanban
              presentation={p}
              records={records}
              layout={layout}
              onCreate={createInLayout}
            />
          ) : (
            window && (
              <>
                {layout.type === "calendar" ? (
                  <CollectionCalendar
                    presentation={p}
                    records={records}
                    layout={layout}
                    window={window}
                    anchor={anchor}
                    onCreate={createInLayout}
                  />
                ) : (
                  <CollectionGantt
                    presentation={p}
                    records={records}
                    layout={layout}
                    window={window}
                    onCreate={createInLayout}
                  />
                )}
                <CollectionDropZone
                  id="unscheduled"
                  value={null}
                  disabled={!canUnschedule || pending}
                  className="min-h-28 border-t bg-muted/15 p-4"
                >
                  <h2 className="mb-3 text-xs font-semibold text-muted-foreground">
                    Unscheduled
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {records
                      .filter(
                        (record) =>
                          calendarDay(record[layout.start]) === undefined
                      )
                      .map((record) => (
                        <CollectionCard
                          key={record.id}
                          record={record}
                          presentation={p}
                        />
                      ))}
                  </div>
                  {records.every(
                    (record) => calendarDay(record[layout.start]) !== undefined
                  ) && (
                    <p className="text-xs text-muted-foreground">
                      {canUnschedule
                        ? "Drag a record here to clear its schedule."
                        : "Every loaded record has a start date."}
                    </p>
                  )}
                </CollectionDropZone>
              </>
            )
          )}
        </DragDropProvider>
      )}
    </div>
  )
}
