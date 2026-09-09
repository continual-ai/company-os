import { DateTime } from "@company/ui/date-time"

/** Audit actors resolve through authorized reads; unavailable actors never block the record body. */
export function RecordAttribution({
  record,
  author,
}: {
  readonly author?: string | undefined
  readonly record: {
    readonly createdBy?: unknown
    readonly createdAt?: unknown
    readonly updatedAt?: unknown
  }
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">
        {author ?? "Unavailable author"}
      </span>
      {typeof record.createdAt === "string" && (
        <DateTime value={record.createdAt} />
      )}
      {typeof record.updatedAt === "string" &&
        record.updatedAt !== record.createdAt && (
          <span>
            Edited <DateTime value={record.updatedAt} />
          </span>
        )}
    </div>
  )
}
