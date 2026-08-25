import { Model } from "@company/model"
import { RecordId } from "@company/runtime"
import { createFileRoute } from "@tanstack/react-router"

import { companyClient } from "@/company-client"
import { ConfirmActionButton } from "@/components/confirm-action-button"
import { ObjectCollection } from "@/components/object-collection"
import type { ObjectTableRecord } from "@/components/object-table/object-table-config"
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
  record,
  refresh,
}: {
  readonly record: ObjectTableRecord
  readonly refresh: () => Promise<void>
}) {
  if (record.convertedAt !== null) return null
  return (
    <ConfirmActionButton
      actionLabel="Convert"
      destructive={false}
      title="Convert this lead?"
      description="This atomically creates a company and contact linked to the lead."
      onConfirm={async () => {
        await companyClient.leads.convert({ id: RecordId("lead")(record.id) })
        await refresh()
      }}
    />
  )
}

function LeadsPage() {
  return (
    <ObjectCollection
      object={Model.objects.lead}
      renderRecordActions={(record, refresh) => (
        <LeadActions record={record} refresh={refresh} />
      )}
    />
  )
}
