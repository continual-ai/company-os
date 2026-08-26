import { Model } from "@company/model"
import { RecordId } from "@company/runtime"
import { Effect } from "effect"

import { httpClient } from "@/http-client"
import { ConfirmActionButton } from "@/ui/model/confirm-action-button"
import { ObjectCollection } from "@/ui/model/object-collection"
import type { ObjectTableRecord } from "@/ui/model/object-table/object-table-config"

function LeadActions({
  canConvert,
  record,
  refresh,
}: {
  readonly canConvert: boolean
  readonly record: ObjectTableRecord
  readonly refresh: () => Promise<void>
}) {
  if (!canConvert || record.convertedAt !== null) return null
  return (
    <ConfirmActionButton
      actionLabel="Convert"
      destructive={false}
      title="Convert this lead?"
      description="This atomically creates a company and contact linked to the lead."
      onConfirm={async () => {
        await Effect.runPromise(
          httpClient.lead.convertLead({
            params: { id: RecordId("lead")(record.id) },
          })
        )
        await refresh()
      }}
    />
  )
}

export function LeadsPage() {
  return (
    <ObjectCollection
      object={Model.objects.lead}
      renderRecordActions={(record, { can, refresh }) => (
        <LeadActions
          canConvert={can("convert")}
          record={record}
          refresh={refresh}
        />
      )}
    />
  )
}
