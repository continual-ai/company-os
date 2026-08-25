import { Model } from "@company/model"
import { RecordId } from "@company/runtime"
import { toEffectInputSchema } from "@company/runtime/effect"
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
import { Field, FieldError, FieldLabel } from "@company/ui/components/field"
import { Input } from "@company/ui/components/input"
import { createFileRoute } from "@tanstack/react-router"
import { MailPlusIcon } from "lucide-react"
import { useState } from "react"

import { companyClient } from "@/company-client"
import { ConfirmActionButton } from "@/components/confirm-action-button"
import { decodeFormSchema, FormValidationError } from "@/components/form-errors"
import { FormField } from "@/components/form-field"
import { ObjectCollection } from "@/components/object-collection"
import { dateTimeLocalValue } from "@/components/object-form"
import { ObjectReferenceSelect } from "@/components/object-reference-select"
import type { ObjectTableRecord } from "@/components/object-table/object-table-config"
import { useFormSubmission } from "@/components/use-form-submission"
import { formText } from "@/form-data"
import { pageOptions } from "@/route-metadata"
import { PLATFORM_ID } from "@/system-records"

const page = {
  breadcrumb: "Invitations",
  description: "Invite verified users into a source-owned role.",
  title: "Invitations",
}

const platformRoleConstraints = [
  { field: "scopeType", value: Model.root.id },
] as const

const issueInputSchema = toEffectInputSchema(
  Model.actions.invitation.issue.input
)

function decodeIssueInput(data: FormData) {
  try {
    const input = {
      email: formText(data, "email"),
      expiresAt: new Date(formText(data, "expiresAt")).toISOString(),
      role: formText(data, "role"),
      scope: formText(data, "scope"),
    }
    return decodeFormSchema(issueInputSchema, input)
  } catch (cause) {
    if (cause instanceof FormValidationError) throw cause
    throw new FormValidationError([
      {
        message: "Enter a valid expiration time.",
        path: ["expiresAt"],
        reason: "INVALID_TIMESTAMP",
      },
    ])
  }
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
  const [open, setOpen] = useState(false)
  const [redemptionToken, setRedemptionToken] = useState<string>()
  const submission = useFormSubmission({
    fallback: "Issuing the invitation failed.",
    onSubmit: async (data) => {
      const issued = await companyClient.invitations.issue(
        decodeIssueInput(data)
      )
      setRedemptionToken(issued.redemptionToken)
      await refresh().catch(() => undefined)
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setRedemptionToken(undefined)
          submission.resetErrors()
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <MailPlusIcon />
        Issue invitation
      </DialogTrigger>
      <DialogContent>
        {redemptionToken === undefined ? (
          <form
            noValidate
            className="grid gap-4"
            onInput={submission.handleInput}
            onSubmit={submission.handleSubmit}
          >
            <DialogHeader>
              <DialogTitle>Issue invitation</DialogTitle>
              <DialogDescription>
                Share the one-time token through a trusted channel. Email
                delivery can be supplied by the deployment environment later.
              </DialogDescription>
            </DialogHeader>
            <FormField
              errors={submission.errors}
              id="invitation-email"
              label="Email"
              name="email"
            >
              {({ ariaDescribedBy, invalid }) => (
                <Input
                  required
                  id="invitation-email"
                  name="email"
                  type="email"
                  aria-invalid={invalid}
                  aria-describedby={ariaDescribedBy}
                />
              )}
            </FormField>
            <Field>
              <FieldLabel htmlFor="invitation-scope">Scope</FieldLabel>
              <input type="hidden" name="scope" value={PLATFORM_ID} />
              <div
                id="invitation-scope"
                className="flex h-8 items-center border border-input bg-muted/20 px-2 text-xs"
              >
                {Model.root.name}
              </div>
            </Field>
            <FormField
              errors={submission.errors}
              id="invitation-role"
              label="Role"
              name="role"
            >
              {({ ariaDescribedBy, invalid }) => (
                <ObjectReferenceSelect
                  ariaDescribedBy={ariaDescribedBy}
                  id="invitation-role"
                  invalid={invalid}
                  required
                  name="role"
                  typeId={Model.objects.role.id}
                  constraints={platformRoleConstraints}
                  placeholder="Select a platform role"
                />
              )}
            </FormField>
            <FormField
              errors={submission.errors}
              id="invitation-expires"
              label="Expires"
              name="expiresAt"
            >
              {({ ariaDescribedBy, invalid }) => (
                <Input
                  required
                  id="invitation-expires"
                  name="expiresAt"
                  type="datetime-local"
                  defaultValue={dateTimeLocalValue(
                    new Date(Date.now() + 7 * 86_400_000).toISOString()
                  )}
                  aria-invalid={invalid}
                  aria-describedby={ariaDescribedBy}
                />
              )}
            </FormField>
            <FieldError errors={submission.errors.form} />
            <DialogFooter>
              <Button type="submit" disabled={submission.pending}>
                {submission.pending ? "Issuing…" : "Issue invitation"}
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
