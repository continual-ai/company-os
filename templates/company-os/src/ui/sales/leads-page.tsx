import { Model } from "@company/model"
import { RecordId } from "@company/runtime"
import { Effect } from "effect"

import { client } from "@/app-client"
import { ConfirmActionButton } from "@/ui/model/confirm-action-button"
import { ObjectCollection } from "@/ui/model/object-collection"
import type { ObjectCollectionSearch } from "@/ui/model/object-collection-view"
import type { ObjectTableRecord } from "@/ui/model/object-table/object-table-config"

export function LeadActions({
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
          client.lead.convert({ id: RecordId("lead")(record.id) })
        )
        await refresh()
      }}
    />
  )
}

export function LeadsPage({
  onSearchChange,
  search,
  views,
}: {
  readonly onSearchChange: (search: ObjectCollectionSearch) => void
  readonly search: ObjectCollectionSearch
  readonly views: Parameters<typeof ObjectCollection>[0]["views"]
}) {
  return (
    <ObjectCollection
      object={Model.objects.lead}
      recordHref={(recordId) => `/leads/${recordId}`}
      onSearchChange={onSearchChange}
      search={search}
      views={views}
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
