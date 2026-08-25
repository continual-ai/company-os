import { Model } from "@company/model"
import {
  EmailAddress,
  RecordId,
  Timestamp,
  type RecordId as RecordIdType,
} from "@company/runtime"
import { Button } from "@company/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@company/ui/components/dialog"
import { Input } from "@company/ui/components/input"
import { Label } from "@company/ui/components/label"
import { createFileRoute } from "@tanstack/react-router"
import { MailPlusIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { companyClient } from "@/company-client"
import { ConfirmActionButton } from "@/components/confirm-action-button"
import { ObjectCollection } from "@/components/object-collection"
import type { ObjectTableRecord } from "@/components/object-table/object-table-config"
import { formText } from "@/form-data"
import { pageOptions } from "@/route-metadata"
import { PLATFORM_ID } from "@/system-records"

const page = {
  breadcrumb: "Invitations",
  description: "Invite verified users into a source-owned role.",
  title: "Invitations",
}

export const Route = createFileRoute("/_app/settings/invitations")({
  ...pageOptions(page),
  component: InvitationsSettings,
})

function IssueInvitation({
  refresh,
}: {
  readonly refresh: () => Promise<void>
}) {
  const [roles, setRoles] = useState<
    ReadonlyArray<{ id: RecordIdType<"role">; name: string }>
  >([])
  const [error, setError] = useState<string>()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [redemptionToken, setRedemptionToken] = useState<string>()

  useEffect(() => {
    if (!open) return
    void companyClient.roles
      .list()
      .then((response) =>
        setRoles(
          response.items.map((role) => ({ id: role.id, name: role.name }))
        )
      )
  }, [open])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setRedemptionToken(undefined)
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <MailPlusIcon />
        Issue invitation
      </DialogTrigger>
      <DialogContent>
        {redemptionToken === undefined ? (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              setPending(true)
              setError(undefined)
              const expiresAt = new Date(formText(form, "expiresAt"))
              void companyClient.invitations
                .issue({
                  email: EmailAddress(
                    formText(form, "email").trim().toLowerCase()
                  ),
                  expiresAt: Timestamp(expiresAt.toISOString()),
                  role: RecordId("role")(formText(form, "role")),
                  scope: RecordId("authorizationScope")(PLATFORM_ID),
                })
                .then((issued) => {
                  setRedemptionToken(issued.redemptionToken)
                  return refresh()
                })
                .catch((cause: unknown) =>
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Issuing the invitation failed."
                  )
                )
                .finally(() => setPending(false))
            }}
          >
            <DialogHeader>
              <DialogTitle>Issue invitation</DialogTitle>
              <DialogDescription>
                Share the one-time token through a trusted channel. Email
                delivery can be supplied by the deployment environment later.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="invitation-email">Email</Label>
              <Input required id="invitation-email" name="email" type="email" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="invitation-role">Role</Label>
              <select
                required
                id="invitation-role"
                name="role"
                className="h-8 border border-input bg-background px-2 text-xs"
              >
                <option value="">Select role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="invitation-expires">Expires</Label>
              <Input
                required
                id="invitation-expires"
                name="expiresAt"
                type="datetime-local"
                defaultValue={new Date(Date.now() + 7 * 86_400_000)
                  .toISOString()
                  .slice(0, 16)}
              />
            </div>
            {error === undefined ? null : (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={pending || roles.length === 0}>
                {pending ? "Issuing…" : "Issue invitation"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Copy the redemption token</DialogTitle>
              <DialogDescription>
                This token is shown once and expires at the time you selected.
              </DialogDescription>
            </DialogHeader>
            <code className="border bg-muted/30 p-3 text-xs break-all">
              {redemptionToken}
            </code>
            <DialogFooter>
              <Button
                type="button"
                onClick={() =>
                  void navigator.clipboard.writeText(redemptionToken)
                }
              >
                Copy token
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function InvitationActions({
  record,
  refresh,
}: {
  readonly record: ObjectTableRecord
  readonly refresh: () => Promise<void>
}) {
  if (record.status !== "pending") return null
  return (
    <ConfirmActionButton
      actionLabel="Revoke"
      title="Revoke this invitation?"
      description="The one-time redemption token will stop working immediately."
      onConfirm={async () => {
        await companyClient.invitations.revoke({
          id: RecordId("invitation")(record.id),
        })
        await refresh()
      }}
    />
  )
}

function InvitationsSettings() {
  return (
    <ObjectCollection
      object={Model.objects.invitation}
      renderCollectionActions={(refresh) => (
        <IssueInvitation refresh={refresh} />
      )}
      renderRecordActions={(record, refresh) => (
        <InvitationActions record={record} refresh={refresh} />
      )}
    />
  )
}
