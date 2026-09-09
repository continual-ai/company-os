import { useHydrated } from "@tanstack/react-router"

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
  const hydrated = useHydrated()
  const timestamp =
    typeof record.createdAt === "string" ? record.createdAt : undefined
  const date = timestamp ? new Date(timestamp) : undefined
  const formatted =
    date && !Number.isNaN(date.valueOf())
      ? new Intl.DateTimeFormat("en", {
          timeZone: hydrated ? undefined : "UTC",
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }).format(date)
      : undefined
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">
        {author ?? "Unavailable author"}
      </span>
      {formatted && (
        <time dateTime={timestamp} title={timestamp}>
          {formatted}
        </time>
      )}
      {record.updatedAt !== record.createdAt && <span>Edited</span>}
    </div>
  )
}
