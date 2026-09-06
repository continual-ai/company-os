import { Button } from "@company/ui/components/button"
import { cn } from "@company/ui/lib/utils"
import { useDraggable, useDroppable } from "@dnd-kit/react"
import { Link } from "@tanstack/react-router"
import { GripVerticalIcon, PencilIcon } from "lucide-react"
import type { ReactNode } from "react"

import {
  modelObjectProperty,
  recordLabel,
  tableRecord,
  type ClientRecord,
  type ModelObject,
  type ObjectRecordPresentation,
} from "./object-client"
import { objectPropertyValue } from "./object-property-value"
import { objectHref } from "./object-routing"

export type CollectionDragData = {
  record?: ClientRecord
  anchor?: string | undefined
  resize?: boolean
  value?: string | null
}
export interface CollectionPresentation {
  object: ModelObject
  columns: ReadonlyArray<string>
  references: ReadonlyMap<string, ObjectRecordPresentation>
  recordHref?: ((id: string) => string) | undefined
  canMove: (record: ClientRecord) => boolean
  canEdit: (record: ClientRecord) => boolean
  onEdit: (record: ClientRecord) => void
  renderActions: (record: ClientRecord) => ReactNode
}

export function CollectionCard({
  presentation: p,
  record,
  compact = false,
  occurrence = "",
  anchor,
}: {
  presentation: CollectionPresentation
  record: ClientRecord
  compact?: boolean
  occurrence?: string
  anchor?: string
}) {
  const { ref, handleRef, isDragging } = useDraggable<CollectionDragData>({
    id: `${record.id}:${occurrence}`,
    data: { record, anchor },
    disabled: !p.canMove(record),
  })
  const label = recordLabel(p.object, record)
  const projected = tableRecord(p.object, record)
  return (
    <article
      ref={ref}
      className={cn(
        "group/card min-w-0 rounded-lg border bg-card text-card-foreground shadow-xs transition-shadow hover:shadow-md",
        isDragging && "opacity-40",
        compact ? "p-1.5" : "p-3"
      )}
    >
      <div className="flex items-start gap-1">
        {p.canMove(record) && (
          <button
            ref={handleRef}
            type="button"
            aria-label={`Move ${label}`}
            className="shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"
          >
            <GripVerticalIcon className="size-3.5" />
          </button>
        )}
        <Link
          to={p.recordHref?.(record.id) ?? objectHref(p.object, record.id)}
          className={cn(
            "min-w-0 flex-1 font-medium hover:underline focus-visible:outline-ring",
            compact ? "truncate text-xs" : "line-clamp-3 text-sm"
          )}
        >
          {label}
        </Link>
        {compact && p.canEdit(record) && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Edit ${label}`}
            onClick={() => p.onEdit(record)}
          >
            <PencilIcon />
          </Button>
        )}
      </div>
      {!compact && (
        <>
          <dl className="mt-3 space-y-2">
            {p.columns
              .filter(
                (field) =>
                  field !== p.object.display.title &&
                  record[field] !== null &&
                  record[field] !== undefined
              )
              .slice(0, 4)
              .map((field) => (
                <div
                  key={field}
                  className="flex min-w-0 items-center justify-between gap-2 text-xs"
                >
                  <dt className="shrink-0 text-muted-foreground">
                    {modelObjectProperty(p.object, field)?.label ?? field}
                  </dt>
                  <dd className="max-w-[65%] truncate text-right">
                    {objectPropertyValue(
                      p.object,
                      field,
                      projected[field],
                      p.references
                    )}
                  </dd>
                </div>
              ))}
          </dl>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-1 border-t pt-2">
            {p.renderActions(record)}
          </div>
        </>
      )}
    </article>
  )
}

export function CollectionDropZone({
  id,
  value,
  children,
  className,
  disabled = false,
}: {
  id: string
  value: string | null
  children?: ReactNode
  className?: string
  disabled?: boolean
}) {
  const { ref, isDropTarget } = useDroppable<CollectionDragData>({
    id,
    data: { value },
    disabled,
  })
  return (
    <div
      ref={ref}
      className={cn(
        className,
        isDropTarget && "bg-primary/10 ring-2 ring-primary/50 ring-inset"
      )}
    >
      {children}
    </div>
  )
}
