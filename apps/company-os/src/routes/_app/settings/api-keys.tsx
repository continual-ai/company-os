import { Model } from "@company/model"
import { RecordId, type RecordId as RecordIdType } from "@company/runtime"
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
import { KeyRoundIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { companyClient } from "@/company-client"
import { ConfirmActionButton } from "@/components/confirm-action-button"
import { ObjectCollection } from "@/components/object-collection"
import type { ObjectTableRecord } from "@/components/object-table/object-table-config"
import { formText } from "@/form-data"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "API keys",
  description: "Issue and revoke credentials for service accounts.",
  title: "API keys",
}

export const Route = createFileRoute("/_app/settings/api-keys")({
  ...pageOptions(page),
  component: ApiKeysSettings,
})

function IssueApiKey({ refresh }: { readonly refresh: () => Promise<void> }) {
  const [accounts, setAccounts] = useState<
    ReadonlyArray<{ id: RecordIdType<"serviceAccount">; name: string }>
  >([])
  const [error, setError] = useState<string>()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [secret, setSecret] = useState<string>()

  useEffect(() => {
    if (!open) return
    void companyClient.serviceAccounts
      .list()
      .then((response) =>
        setAccounts(
          response.items
            .filter(
              (account) => account.status === "active" && !account.systemManaged
            )
            .map((account) => ({ id: account.id, name: account.name }))
        )
      )
  }, [open])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSecret(undefined)
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <KeyRoundIcon />
        Issue API key
      </DialogTrigger>
      <DialogContent>
        {secret === undefined ? (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              setPending(true)
              setError(undefined)
              void companyClient.apiKeys
                .issue({
                  name: formText(form, "name"),
                  serviceAccount: RecordId("serviceAccount")(
                    formText(form, "serviceAccount")
                  ),
                })
                .then((issued) => {
                  setSecret(issued.secret)
                  return refresh()
                })
                .catch((cause: unknown) =>
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Issuing the key failed."
                  )
                )
                .finally(() => setPending(false))
            }}
          >
            <DialogHeader>
              <DialogTitle>Issue API key</DialogTitle>
              <DialogDescription>
                The secret is shown once. Store it in your deployment secret
                manager.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="api-key-account">Service account</Label>
              <select
                required
                id="api-key-account"
                name="serviceAccount"
                className="h-8 border border-input bg-background px-2 text-xs"
              >
                <option value="">Select service account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="api-key-name">Name</Label>
              <Input
                required
                id="api-key-name"
                name="name"
                placeholder="Production integration"
              />
            </div>
            {error === undefined ? null : (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={pending || accounts.length === 0}>
                {pending ? "Issuing…" : "Issue key"}
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
  record,
  refresh,
}: {
  readonly record: ObjectTableRecord
  readonly refresh: () => Promise<void>
}) {
  if (record.revokedAt !== null) return null
  return (
    <ConfirmActionButton
      actionLabel="Revoke"
      title="Revoke this API key?"
      description="Requests using this key will fail immediately."
      onConfirm={async () => {
        await companyClient.apiKeys.revoke({
          id: RecordId("apiKey")(record.id),
        })
        await refresh()
      }}
    />
  )
}

function ApiKeysSettings() {
  return (
    <ObjectCollection
      object={Model.objects.apiKey}
      renderCollectionActions={(refresh) => <IssueApiKey refresh={refresh} />}
      renderRecordActions={(record, refresh) => (
        <ApiKeyActions record={record} refresh={refresh} />
      )}
    />
  )
}
