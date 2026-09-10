import { DateTime } from "@company/ui/date-time"
import { UserRoundIcon } from "lucide-react"

import type { ObjectRecordPresentation } from "#/runtime/ui/model/object-client.ts"
import { ObjectRecordIdentity } from "#/runtime/ui/model/object-record-identity.tsx"

/** Audit actors resolve through project reads; unavailable actors never block the record body. */
export function RecordAttribution({
  record,
  author,
}: {
  readonly author?: ObjectRecordPresentation | undefined
  readonly record: {
    readonly createdBy?: unknown
    readonly createdAt?: unknown
    readonly updatedAt?: unknown
  }
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      {author ? (
        <ObjectRecordIdentity
          {...author}
          className="font-medium text-foreground"
        />
      ) : (
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          <UserRoundIcon
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          Unavailable author
        </span>
      )}
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
