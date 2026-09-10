import { Button } from "@company/ui/button"
import { Checkbox } from "@company/ui/checkbox"
import { Label } from "@company/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@company/ui/select"
import { toast } from "@company/ui/toast"
import { useMutation } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import {
  ExampleProject,
  exampleModel,
  exampleRecords,
} from "#/app/ui/developer/design-system/example-model.ts"
import { Example } from "#/app/ui/developer/design-system/example.tsx"
import type { CollectionLayout } from "#/runtime/ui/model/collection-layout.ts"
import { CollectionVisual } from "#/runtime/ui/model/collection-visual.tsx"
import { ObjectChoiceBadge } from "#/runtime/ui/model/object-choice-badge.tsx"
import {
  modelObjectProperty,
  tableRecord,
  type ClientRecord,
} from "#/runtime/ui/model/object-client.ts"
import type { ObjectFormInput } from "#/runtime/ui/model/object-form.ts"
import { objectPropertyValue } from "#/runtime/ui/model/object-property-value.tsx"
import { ObjectRecordDialog } from "#/runtime/ui/model/object-record-dialog.tsx"
import { ObjectRecordIdentity } from "#/runtime/ui/model/object-record-identity.tsx"
import { ObjectRecordStatusProgress } from "#/runtime/ui/model/object-record-status-progress.tsx"
import { ObjectTable } from "#/runtime/ui/model/object-table/object-table.tsx"
import {
  ModelUiProvider,
  useModelRuntime,
} from "#/runtime/ui/model/runtime-context.tsx"

export function Patterns({
  section,
}: {
  section: "records" | "table" | "layouts" | "forms"
}) {
  const runtime = useModelRuntime()
  const preview = useMemo(
    () => ({
      ...runtime,
      model: exampleModel,
      ui: {},
      data: {},
    }),
    [runtime]
  )
  return (
    <ModelUiProvider value={preview}>
      <PatternExamples key={section} section={section} />
    </ModelUiProvider>
  )
}

function PatternExamples({
  section,
}: {
  section: "records" | "table" | "layouts" | "forms"
}) {
  const runtime = useModelRuntime()
  const [records, setRecords] = useState(exampleRecords)
  const [editing, setEditing] = useState<ClientRecord>()
  const [open, setOpen] = useState(false)
  const [failSave, setFailSave] = useState(false)
  const [state, setState] = useState("populated")
  const [layout, setLayout] = useState<
    Exclude<CollectionLayout, { type: "table" | "feed" }>
  >({ type: "kanban", groupBy: "status" })
  const [anchor, setAnchor] = useState("2026-09-09")
  const first = records[0] ?? exampleRecords[0]!
  const references = new Map()
  const projected = tableRecord(ExampleProject, first)
  const statusUpdate = useMutation({
    mutationFn: ({ field, value }: { field: string; value: string }) =>
      update(first, { [field]: value }),
  })

  async function update(record: ClientRecord, changes: ObjectFormInput) {
    if (failSave)
      throw new Error(
        "Example save failed. Turn off simulated failure and try again."
      )
    setRecords((current) =>
      current.map((item) =>
        item.id === record.id ? { ...item, ...changes } : item
      )
    )
  }

  function edit(record: ClientRecord) {
    setEditing(record)
    setOpen(true)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Interactive examples. Changes stay in this preview.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setRecords(exampleRecords)
            setState("populated")
            setFailSave(false)
          }}
        >
          Reset examples
        </Button>
      </div>
      {section === "records" && (
        <>
          <Example
            title="Record identities"
            source="runtime/ui/model/object-record-identity.tsx"
          >
            <div className="space-y-6">
              <ObjectRecordIdentity
                object={ExampleProject}
                record={projected}
              />
              <ObjectRecordIdentity
                expanded
                object={ExampleProject}
                record={projected}
              />
              <ObjectRecordIdentity
                object={ExampleProject}
                record={{ ...projected, name: "" }}
              />
            </div>
          </Example>
          <Example
            title="Record status"
            source="runtime/ui/model/object-record-status-progress.tsx"
          >
            <ObjectRecordStatusProgress
              object={ExampleProject}
              record={projected}
              onChange={(field, value) => statusUpdate.mutate({ field, value })}
              pendingValue={
                statusUpdate.isPending
                  ? statusUpdate.variables.value
                  : undefined
              }
              error={statusUpdate.error?.message}
            />
            <Label
              htmlFor="ds-status-save-failure"
              className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Checkbox
                id="ds-status-save-failure"
                checked={failSave}
                onCheckedChange={setFailSave}
              />
              Simulate status save failure
            </Label>
          </Example>
          <Example
            title="Choices and property values"
            source="runtime/ui/model/object-choice-badge.tsx · object-property-value.tsx"
          >
            <div className="mb-6 flex flex-wrap gap-3">
              <ObjectChoiceBadge
                choice={{ value: "neutral", label: "Neutral" }}
              />
              <ObjectChoiceBadge
                choice={{ value: "active", label: "Active", color: "blue" }}
              />
              <ObjectChoiceBadge
                choice={{
                  value: "review",
                  label: "Needs review",
                  color: "yellow",
                }}
              />
              <ObjectChoiceBadge
                choice={{
                  value: "complete",
                  label: "Complete",
                  color: "green",
                }}
              />
              <ObjectChoiceBadge
                choice={{ value: "blocked", label: "Blocked", color: "red" }}
              />
            </div>
            <dl className="grid gap-4 sm:grid-cols-2">
              {["status", "score", "budget", "email", "description"].map(
                (id) => (
                  <div key={id}>
                    <dt className="mb-1 text-xs text-muted-foreground">
                      {modelObjectProperty(ExampleProject, id)?.label}
                    </dt>
                    <dd className="text-sm">
                      {objectPropertyValue(
                        runtime,
                        ExampleProject,
                        id,
                        projected[id],
                        references
                      )}
                    </dd>
                  </div>
                )
              )}
              <div>
                <dt className="mb-1 text-xs text-muted-foreground">
                  Missing value
                </dt>
                <dd>
                  {objectPropertyValue(
                    runtime,
                    ExampleProject,
                    "email",
                    null,
                    references
                  )}
                </dd>
              </div>
            </dl>
          </Example>
        </>
      )}
      {section === "table" && (
        <Example
          title="Object table"
          source="runtime/ui/model/object-table/object-table.tsx"
        >
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Label htmlFor="ds-table-state">State</Label>
            <Select
              value={state}
              onValueChange={(value) => setState(value ?? "populated")}
              items={{
                populated: "Populated",
                empty: "Empty",
                loading: "Loading",
                error: "Pagination error",
              }}
            >
              <SelectTrigger id="ds-table-state">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  ["populated", "Populated"],
                  ["empty", "Empty"],
                  ["loading", "Loading"],
                  ["error", "Pagination error"],
                ].map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label htmlFor={`ds-${section}-fail`}>
              <Checkbox
                id={`ds-${section}-fail`}
                checked={failSave}
                onCheckedChange={setFailSave}
              />
              Simulate save failure
            </Label>
          </div>
          <div className="flex h-[30rem] min-w-0 flex-col overflow-hidden rounded-md border">
            <ObjectTable
              key={state}
              object={ExampleProject}
              records={
                state === "empty" || state === "loading"
                  ? []
                  : records.map((record) => tableRecord(ExampleProject, record))
              }
              visiblePropertyIds={[
                "name",
                "status",
                "score",
                "budget",
                "startsOn",
                "email",
              ]}
              canUpdateRecord={() => true}
              canDeleteRecord={() => true}
              enableRowSelection
              onCreateRecord={() => {
                setEditing(undefined)
                setOpen(true)
              }}
              onCellCommit={async (id, property, value) => {
                const record = records.find((item) => item.id === id)
                if (record) await update(record, { [property]: value })
              }}
              onDeleteRecords={(ids) =>
                setRecords((current) =>
                  current.filter((record) => !ids.includes(record.id))
                )
              }
              renderSelectedRecordActions={(id) => {
                const record = records.find((item) => item.id === id)
                return record ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => edit(record)}
                  >
                    Edit
                  </Button>
                ) : null
              }}
              pagination={
                state === "loading" || state === "error"
                  ? {
                      hasNextPage: true,
                      loading: state === "loading",
                      error:
                        state === "error"
                          ? "Could not load more example records."
                          : undefined,
                      totalSize: 12,
                      onNextPage: () => setState("populated"),
                    }
                  : undefined
              }
            />
          </div>
        </Example>
      )}
      {section === "layouts" && (
        <Example
          title="Collection layouts"
          source="runtime/ui/model/collection-visual.tsx · collection-card.tsx · collection-kanban.tsx · collection-calendar.tsx · collection-gantt.tsx"
        >
          <div className="mb-4 flex flex-wrap gap-2">
            {(["kanban", "calendar", "gantt"] as const).map((type) => (
              <Button
                key={type}
                variant={layout.type === type ? "secondary" : "ghost"}
                aria-pressed={layout.type === type}
                onClick={() =>
                  setLayout(
                    type === "kanban"
                      ? { type, groupBy: "status" }
                      : { type, start: "startsOn", end: "endsOn" }
                  )
                }
              >
                {type === "kanban"
                  ? "Board"
                  : type === "calendar"
                    ? "Calendar"
                    : "Timeline"}
              </Button>
            ))}
          </div>
          <div className="overflow-hidden rounded-lg border">
            <CollectionVisual
              presentation={{
                object: ExampleProject,
                columns: ["budget", "startsOn", "endsOn"],
                references,
                canMove: () => true,
                canEdit: () => true,
                onEdit: edit,
                renderActions: () => null,
                recordHref: () => "/developer/design-system#records",
              }}
              records={records}
              layout={layout}
              anchor={anchor}
              onDateChange={setAnchor}
              onUpdate={update}
              loading={false}
            />
          </div>
        </Example>
      )}
      {section === "forms" && (
        <Example
          title="Generated record editor"
          source="runtime/ui/model/object-record-dialog.tsx · object-form-fields.tsx · runtime/ui/forms/app-form.ts"
        >
          <p className="mb-5 max-w-xl text-sm leading-6 text-muted-foreground">
            The real editor, including schema validation, field errors,
            submission feedback, and confirmation before discarding a draft.
            Clear the name or enter an invalid email to inspect validation.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => edit(first)}>Edit example project</Button>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(undefined)
                setOpen(true)
              }}
            >
              New example project
            </Button>
            <Label htmlFor={`ds-${section}-fail`}>
              <Checkbox
                id={`ds-${section}-fail`}
                checked={failSave}
                onCheckedChange={setFailSave}
              />
              Simulate save failure
            </Label>
          </div>
          <div className="mt-6">
            <ObjectRecordIdentity
              expanded
              object={ExampleProject}
              record={projected}
            />
          </div>
        </Example>
      )}
      <ObjectRecordDialog
        object={ExampleProject}
        mode={editing ? "edit" : "create"}
        record={editing}
        open={open}
        onOpenChange={setOpen}
        referenceLabels={new Map()}
        onSave={async (input) => {
          if (editing) await update(editing, input)
          else {
            if (failSave)
              throw new Error(
                "Example save failed. Turn off simulated failure and try again."
              )
            setRecords((current) => [
              ...current,
              {
                ...input,
                id: `design_project_${crypto.randomUUID()}`,
                etag: "preview",
              },
            ])
          }
          toast.success("Saved in preview")
        }}
      />
    </div>
  )
}
