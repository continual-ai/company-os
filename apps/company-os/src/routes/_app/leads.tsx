import { Model } from "@company/model"
import { RecordId } from "@company/runtime"
import { createFileRoute } from "@tanstack/react-router"
import { Effect } from "effect"

import { ConfirmActionButton } from "@/components/confirm-action-button"
import { ObjectCollection } from "@/components/object-collection"
import type { ObjectTableRecord } from "@/components/object-table/object-table-config"
import { httpClient } from "@/http-client"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Leads",
  description: Model.objects.lead.description ?? "Browse lead records.",
  title: "Leads",
}

export const Route = createFileRoute("/_app/leads")({
  ...pageOptions(page),
  component: LeadsPage,
})

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

function LeadsPage() {
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
