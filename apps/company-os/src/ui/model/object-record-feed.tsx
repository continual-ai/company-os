import type { ReactNode } from "react"

import type { ClientRecord, ModelObject } from "./object-client"
import { ObjectRecordSummary } from "./object-record-summary"
import { useRecordReferences } from "./object-references"

/** Collection owners supply loaded records and actions; summaries remain reusable presentation. */
export function ObjectRecordFeed({
  items,
  label,
  loading,
  recordHref,
  renderActions,
}: {
  readonly items: ReadonlyArray<{
    readonly object: ModelObject
    readonly record: ClientRecord
  }>
  readonly label: string
  readonly loading: boolean
  readonly recordHref?: ((id: string) => string) | undefined
  readonly renderActions?: ((record: ClientRecord) => ReactNode) | undefined
}) {
  const references = useRecordReferences(items)
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {loading ? "Loading…" : `No ${label.toLowerCase()} yet.`}
        </p>
      ) : (
        <ol className="mx-auto max-w-3xl space-y-3">
          {items.map(({ object, record }) => (
            <li
              key={`${object.id}:${record.id}`}
              className="rounded-lg border bg-card p-4"
            >
              <ObjectRecordSummary
                object={object}
                record={record}
                author={references.labels.get(
                  typeof record.createdBy === "string" ? record.createdBy : ""
                )}
                href={recordHref?.(record.id)}
                variant="feed"
                actions={renderActions?.(record)}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
