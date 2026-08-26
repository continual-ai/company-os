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
import { FieldError } from "@company/ui/components/field"
import { Input } from "@company/ui/components/input"
import { createFileRoute } from "@tanstack/react-router"
import { Effect } from "effect"
import { KeyRoundIcon } from "lucide-react"
import { useState } from "react"

import { companyApi } from "@/company-client"
import { ConfirmActionButton } from "@/components/confirm-action-button"
import { decodeFormSchema, FormValidationError } from "@/components/form-errors"
import { FormField } from "@/components/form-field"
import { ObjectCollection } from "@/components/object-collection"
import { ObjectReferenceSelect } from "@/components/object-reference-select"
import type { ObjectTableRecord } from "@/components/object-table/object-table-config"
import { useFormSubmission } from "@/components/use-form-submission"
import { formText } from "@/form-data"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "API keys",
  description: "Issue and revoke credentials for service accounts.",
  title: "API keys",
}

const issuableAccountConstraints = [
  { field: "status", value: "active" },
  { field: "systemManaged", value: false },
] as const

const issueInputSchema = toEffectInputSchema(Model.actions.apiKey.issue.input)

function decodeIssueInput(data: FormData) {
  const expiresAt = formText(data, "expiresAt")
  try {
    const name = formText(data, "name")
    const serviceAccount = formText(data, "serviceAccount")
    const input =
      expiresAt === ""
        ? { name, serviceAccount }
        : {
            expiresAt: new Date(expiresAt).toISOString(),
            name,
            serviceAccount,
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

export const Route = createFileRoute("/_app/settings/api-keys")({
  ...pageOptions(page),
  component: ApiKeysSettings,
})

function IssueApiKey({ refresh }: { readonly refresh: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [secret, setSecret] = useState<string>()
  const submission = useFormSubmission({
    fallback: "Issuing the key failed.",
    onSubmit: async (data) => {
      const issued = await Effect.runPromise(
        companyApi.apiKey.issueApiKeys({ payload: decodeIssueInput(data) })
      )
      setSecret(issued.secret)
      await refresh().catch(() => undefined)
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setSecret(undefined)
          submission.resetErrors()
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <KeyRoundIcon />
        Issue API key
      </DialogTrigger>
      <DialogContent>
        {secret === undefined ? (
          <form
            noValidate
            className="grid gap-4"
            onInput={submission.handleInput}
            onSubmit={submission.handleSubmit}
          >
            <DialogHeader>
              <DialogTitle>Issue API key</DialogTitle>
              <DialogDescription>
                The secret is shown once. Store it in your deployment secret
                manager.
              </DialogDescription>
            </DialogHeader>
            <FormField
              errors={submission.errors}
              id="api-key-account"
              label="Service account"
              name="serviceAccount"
            >
              {({ ariaDescribedBy, invalid }) => (
                <ObjectReferenceSelect
                  ariaDescribedBy={ariaDescribedBy}
                  id="api-key-account"
                  invalid={invalid}
                  required
                  name="serviceAccount"
                  typeId={Model.objects.serviceAccount.id}
                  constraints={issuableAccountConstraints}
                  placeholder="Select an active service account"
                />
              )}
            </FormField>
            <FormField
              errors={submission.errors}
              id="api-key-name"
              label="Name"
              name="name"
            >
              {({ ariaDescribedBy, invalid }) => (
                <Input
                  required
                  id="api-key-name"
                  name="name"
                  placeholder="Production integration"
                  aria-invalid={invalid}
                  aria-describedby={ariaDescribedBy}
                />
              )}
            </FormField>
            <FormField
              description="Optional. Leave blank for a non-expiring key."
              errors={submission.errors}
              id="api-key-expires"
              label="Expires"
              name="expiresAt"
            >
              {({ ariaDescribedBy, invalid }) => (
                <Input
                  id="api-key-expires"
                  name="expiresAt"
                  type="datetime-local"
                  aria-invalid={invalid}
                  aria-describedby={ariaDescribedBy}
                />
              )}
            </FormField>
            <FieldError errors={submission.errors.form} />
            <DialogFooter>
              <Button type="submit" disabled={submission.pending}>
                {submission.pending ? "Issuing…" : "Issue key"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Copy this API key now</DialogTitle>
              <DialogDescription>
                Company OS stores only a hash and cannot show this secret again.
              </DialogDescription>
            </DialogHeader>
            <code className="border bg-muted/30 p-3 text-xs break-all">
              {secret}
            </code>
            <DialogFooter>
              <Button
                type="button"
                onClick={() => void navigator.clipboard.writeText(secret)}
              >
                Copy key
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ApiKeyActions({
  canRevoke,
  record,
  refresh,
}: {
  readonly canRevoke: boolean
  readonly record: ObjectTableRecord
  readonly refresh: () => Promise<void>
}) {
  if (!canRevoke || record.revokedAt !== null) return null
  return (
    <ConfirmActionButton
      actionLabel="Revoke"
      title="Revoke this API key?"
      description="Requests using this key will fail immediately."
      onConfirm={async () => {
        await Effect.runPromise(
          companyApi.apiKey.revokeApiKey({
            params: { id: RecordId("apiKey")(record.id) },
          })
        )
        await refresh()
      }}
    />
  )
}

function ApiKeysSettings() {
  return (
    <ObjectCollection
      object={Model.objects.apiKey}
      renderCollectionActions={({ can, refresh }) =>
        can("issue") ? <IssueApiKey refresh={refresh} /> : null
      }
      renderRecordActions={(record, { can, refresh }) => (
        <ApiKeyActions
          canRevoke={can("revoke")}
          record={record}
          refresh={refresh}
        />
      )}
    />
  )
}
