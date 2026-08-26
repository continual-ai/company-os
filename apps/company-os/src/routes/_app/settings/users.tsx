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
  breadcrumb: "Users",
  description: "Manage the people who can sign in to Company OS.",
  title: "Users",
}

export const Route = createFileRoute("/_app/settings/users")({
  ...pageOptions(page),
  component: UsersSettings,
})

function UserLifecycleAction({
  canRun,
  record,
  refresh,
}: {
  readonly canRun: boolean
  readonly record: ObjectTableRecord
  readonly refresh: () => Promise<void>
}) {
  if (!canRun) return null
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
        return Effect.runPromise(
          suspended
            ? companyApi.user.reactivateUser({ params: { id } })
            : companyApi.user.suspendUser({ params: { id } })
        ).then(refresh)
      }}
    />
  )
}

function UsersSettings() {
  return (
    <ObjectCollection
      object={Model.objects.user}
      renderRecordActions={(record, { can, refresh }) => (
        <UserLifecycleAction
          canRun={can(record.status === "suspended" ? "reactivate" : "suspend")}
          record={record}
          refresh={refresh}
        />
      )}
    />
  )
}
