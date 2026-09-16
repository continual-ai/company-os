import { Badge } from "@company/ui/badge"
import { Button } from "@company/ui/button"
import { Input } from "@company/ui/input"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useId, useState } from "react"

import type { ObjectRecord } from "#/runtime/model/index.ts"
import type { Controller } from "#/runtime/platform/model/controller.ts"
import { PlatformModel } from "#/runtime/platform/model/index.ts"
import { useClient } from "#/runtime/ui/model/use-client.ts"

const timestamp = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "Not yet"

export function ControllerDiagnostics({
  controller,
  targetKey,
}: {
  readonly controller: ObjectRecord<typeof Controller>
  readonly targetKey?: string | undefined
}) {
  const client = useClient(PlatformModel)
  const query = useQuery({
    ...client.controller.status.queryOptions({
      id: controller.id,
      ...(targetKey ? { key: targetKey } : {}),
    }),
    refetchInterval: 3000,
  })
  const reconcile = useMutation({
    ...client.controller.reconcile.mutationOptions(),
    onSuccess: () => {
      void query.refetch()
    },
  })
  const update = useMutation({
    ...client.controller.update.mutationOptions(),
    onSuccess: () => {
      void query.refetch()
    },
  })
  const status = query.data
  return (
    <section aria-label={controller.name} className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <a
            className="font-medium hover:underline"
            href={`/objects/controller/${controller.id}`}
          >
            {controller.name}
          </a>
          <p className="mt-1 text-sm text-muted-foreground">
            {controller.description}
          </p>
        </div>
        {status && (
          <div className="flex flex-wrap gap-2">
            {!status.enabled && (
              <Badge variant="secondary">Module disabled</Badge>
            )}
            {status.paused && <Badge variant="secondary">Paused</Badge>}
            <Badge variant={status.errors ? "destructive" : "secondary"}>
              {status.state === "notStarted" ? "Not started" : status.state}
            </Badge>
          </div>
        )}
      </div>
      {query.isPending && (
        <p className="mt-3 text-sm text-muted-foreground">Loading status…</p>
      )}
      {query.isError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {query.error.message}
        </p>
      )}
      {status && (
        <>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-5">
            <div>
              <dt className="text-muted-foreground">Records</dt>
              <dd>
                {targetKey ??
                  (controller.scope === "record"
                    ? `${status.instances} records`
                    : "Entire collection")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last run</dt>
              <dd>{timestamp(status.lastStartedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last success</dt>
              <dd>{timestamp(status.lastSucceededAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Runs</dt>
              <dd>{status.runs}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Failures</dt>
              <dd>{status.failures}</dd>
            </div>
          </dl>
          {status.agentSessionUrl && (
            <a
              className="mt-3 inline-block text-sm underline underline-offset-4"
              href={status.agentSessionUrl}
            >
              Open agent session
            </a>
          )}
          {status.requeueAt && (
            <p className="mt-3 text-xs text-muted-foreground">
              Next requested follow-up: {timestamp(status.requeueAt)}
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {status.pending} pending · {status.running} running ·{" "}
            {status.errors} currently in error
          </p>
          {status.lastError && (
            <div className="mt-4 text-xs text-destructive">
              <p>Key: {status.lastErrorKey}</p>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3">
                {status.lastError}
              </pre>
            </div>
          )}
        </>
      )}
      <Button
        className="mt-4"
        variant="outline"
        size="sm"
        disabled={!status?.enabled || status.paused || reconcile.isPending}
        onClick={() =>
          reconcile.mutate({
            id: controller.id,
            ...(targetKey ? { key: targetKey } : {}),
          })
        }
      >
        {!targetKey && controller.scope === "record"
          ? "Run all now"
          : "Run now"}
      </Button>
      <Button
        className="mt-4 ml-2"
        variant="outline"
        size="sm"
        disabled={!status || update.isPending}
        onClick={() =>
          update.mutate({ id: controller.id, paused: !status?.paused })
        }
      >
        {status?.paused ? "Resume controller" : "Pause controller"}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">
        {status?.paused
          ? "Paused for all keys. Pending work is retained; already-started runs may finish."
          : "Run now requests reconciliation using the latest state. Pausing applies to all keys."}
      </p>
      {update.isError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {update.error.message}
        </p>
      )}
      {reconcile.isError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {reconcile.error.message}
        </p>
      )}
      {reconcile.isSuccess && (
        <output className="mt-3 block text-sm text-muted-foreground">
          Reconciliation requested. Requests for the same key may coalesce.
        </output>
      )}
    </section>
  )
}

export function ControllerOverview({
  record,
}: {
  readonly record: ObjectRecord<typeof Controller>
}) {
  const [key, setKey] = useState("")
  const inputId = useId()
  return (
    <div className="space-y-4">
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Definition ID</dt>
          <dd>{record.definitionId}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Target</dt>
          <dd>
            <a
              className="underline underline-offset-4"
              href={`/objects/${record.targetObjectType}`}
            >
              {record.targetObjectType}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Minimum interval per key</dt>
          <dd>{record.minInterval ?? "None"}</dd>
        </div>
      </dl>
      {record.scope === "record" && (
        <label htmlFor={inputId} className="block text-sm">
          Inspect a key (leave empty for all keys)
          <Input
            id={inputId}
            className="mt-2 block w-full rounded-md border bg-background px-3 py-2"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="Record ID"
          />
        </label>
      )}
      <ControllerDiagnostics
        key={key}
        controller={record}
        targetKey={key || undefined}
      />
    </div>
  )
}
