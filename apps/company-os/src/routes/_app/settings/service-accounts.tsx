import { Model } from "@company/model"
import { RecordId } from "@company/runtime"
import { createFileRoute } from "@tanstack/react-router"
import { Effect } from "effect"

import { companyApi } from "@/company-client"
import { ConfirmActionButton } from "@/components/confirm-action-button"
import { ObjectCollection } from "@/components/object-collection"
import type { ObjectTableRecord } from "@/components/object-table/object-table-config"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Service accounts",
  description: "Manage identities used by software, integrations, and agents.",
  title: "Service accounts",
}

export const Route = createFileRoute("/_app/settings/service-accounts")({
  ...pageOptions(page),
  component: ServiceAccountsSettings,
})

function ServiceAccountLifecycleAction({
  canRun,
  record,
  refresh,
}: {
  readonly canRun: boolean
  readonly record: ObjectTableRecord
  readonly refresh: () => Promise<void>
}) {
  if (!canRun || record.systemManaged === true) return null
  const disabled = record.status === "disabled"
  const actionLabel = disabled ? "Enable" : "Disable"
  return (
    <ConfirmActionButton
      actionLabel={actionLabel}
      destructive={!disabled}
      title={`${actionLabel} this service account?`}
      description={
        disabled
          ? "This allows active API keys for the service account to authenticate again."
          : "This immediately prevents every API key for the service account from authenticating."
      }
      onConfirm={() => {
        const id = RecordId("serviceAccount")(record.id)
        return Effect.runPromise(
          disabled
            ? companyApi.serviceAccount.enableServiceAccount({
                params: { id },
              })
            : companyApi.serviceAccount.disableServiceAccount({
                params: { id },
              })
        ).then(refresh)
      }}
    />
  )
}

function ServiceAccountsSettings() {
  return (
    <ObjectCollection
      object={Model.objects.serviceAccount}
      renderRecordActions={(record, { can, refresh }) => (
        <ServiceAccountLifecycleAction
          canRun={can(record.status === "disabled" ? "enable" : "disable")}
          record={record}
          refresh={refresh}
        />
      )}
    />
  )
}
