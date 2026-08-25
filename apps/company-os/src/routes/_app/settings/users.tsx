import { Model } from "@company/model"
import { RecordId } from "@company/runtime"
import { createFileRoute } from "@tanstack/react-router"

import { companyClient } from "@/company-client"
import { ConfirmActionButton } from "@/components/confirm-action-button"
import { ObjectCollection } from "@/components/object-collection"
import type { ObjectTableRecord } from "@/components/object-table/object-table-config"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Users",
  description: "Manage the people who can sign in to Company OS.",
  title: "Users",
}

export const Route = createFileRoute("/_app/settings/users")({
  ...pageOptions(page),
  component: UsersSettings,
})

function UserLifecycleAction({
  record,
  refresh,
}: {
  readonly record: ObjectTableRecord
  readonly refresh: () => Promise<void>
}) {
  const suspended = record.status === "suspended"
  const actionLabel = suspended ? "Reactivate" : "Suspend"
  return (
    <ConfirmActionButton
      actionLabel={actionLabel}
      destructive={!suspended}
      title={`${actionLabel} this user?`}
      description={
        suspended
          ? "This restores the user's ability to authenticate."
          : "This prevents the user from authenticating and revokes every active session."
      }
      onConfirm={() => {
        const id = RecordId("user")(record.id)
        return (
          suspended
            ? companyClient.users.reactivate({ id })
            : companyClient.users.suspend({ id })
        ).then(refresh)
      }}
    />
  )
}

function UsersSettings() {
  return (
    <ObjectCollection
      object={Model.objects.user}
      renderRecordActions={(record, refresh) => (
        <UserLifecycleAction record={record} refresh={refresh} />
      )}
    />
  )
}
