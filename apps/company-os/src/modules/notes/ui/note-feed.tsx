import { Button } from "@company/ui/button"
import { ConfirmActionButton } from "@company/ui/confirm-action-button"
import { FieldError } from "@company/ui/field"
import { IconButton } from "@company/ui/icon-button"
import { MarkdownEditor } from "@company/ui/markdown-editor"
import { PageSectionHeader } from "@company/ui/page"
import { functionalUpdate, type SortingState } from "@tanstack/react-table"
import { PencilIcon, Trash2Icon, UnlinkIcon } from "lucide-react"
import { useState } from "react"

import { Note } from "#/modules/notes/model/index.ts"
import {
  formErrorFromCause,
  formErrorMessages,
} from "#/runtime/ui/forms/form-errors.ts"
import { CollectionQueryToolbar } from "#/runtime/ui/model/collection-query-toolbar.tsx"
import type { ObjectCollectionFilter } from "#/runtime/ui/model/collection-view.ts"
import {
  clientFor,
  tableRecord,
  type ClientRecord,
} from "#/runtime/ui/model/object-client.ts"
import { ObjectRecordDialog } from "#/runtime/ui/model/object-record-dialog.tsx"
import { ObjectRecordSummary } from "#/runtime/ui/model/object-record-summary.tsx"
import { ObjectReferenceSelect } from "#/runtime/ui/model/object-reference-select.tsx"
import { readFilterValue } from "#/runtime/ui/model/object-table/object-table-config.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"
import { useObjectCollection } from "#/runtime/ui/model/use-object-collection.ts"
import {
  decodeObjectForm,
  objectFormDefaultValues,
  useAppForm,
  type RelationshipOverviewProps,
} from "#/runtime/ui/module.ts"

/** The same linked notes live in each subject's overview; posting creates and links atomically. */
export function NoteFeed({ relationship }: RelationshipOverviewProps) {
  const [filters, setFilters] = useState<ObjectCollectionFilter[]>([])
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ])
  const collection = useObjectCollection(
    Note,
    filters,
    sorting,
    relationship.list
  )
  const [editing, setEditing] = useState<ClientRecord>()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const mutate = async (operation: () => Promise<void>) => {
    setError(undefined)
    setPending(true)
    try {
      await operation()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update notes."
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <section
      id="record-notes"
      aria-label="Notes"
      className="min-w-0 space-y-4 border-t pt-6"
    >
      <PageSectionHeader>
        <h2 className="text-sm font-semibold">Notes</h2>
        {relationship.connect && (
          <ObjectReferenceSelect
            id="notes-link"
            name="note"
            appearance="action"
            placeholder="Link note"
            typeId={Note.id}
            value=""
            required
            disabled={pending}
            allowCreate={false}
            includeHiddenInput={false}
            selectedValues={collection.records.map((record) => record.id)}
            onBlur={() => undefined}
            onValueChange={(id) =>
              void mutate(() => relationship.connect!(id, Note.id))
            }
          />
        )}
      </PageSectionHeader>
      {collection.canCreate && relationship.creates[0] && (
        <NoteComposer relationship={relationship} />
      )}
      <CollectionQueryToolbar
        object={Note}
        records={collection.records.map((record) => tableRecord(Note, record))}
        columnFilters={filters}
        sorting={sorting}
        onColumnFiltersChange={(update) =>
          setFilters((current) =>
            functionalUpdate(update, current).map((filter) => ({
              id: filter.id,
              value: readFilterValue(filter.value),
            }))
          )
        }
        onSortingChange={setSorting}
      />
      {(error || collection.error) && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 text-sm text-destructive"
        >
          {error ?? collection.error}
          {collection.error && (
            <Button variant="ghost" onClick={() => void collection.load()}>
              Retry
            </Button>
          )}
        </div>
      )}
      <ol className="space-y-4">
        {collection.records.map((record) => (
          <li key={record.id} className="min-w-0 rounded-lg bg-muted/30 p-4">
            <ObjectRecordSummary
              object={Note}
              record={record}
              author={collection.references.get(
                typeof record.createdBy === "string" ? record.createdBy : ""
              )}
              variant="feed"
              actions={
                <>
                  {collection.canUpdate(record.id) && (
                    <IconButton
                      label="Edit note"
                      onClick={() => setEditing(record)}
                    >
                      <PencilIcon />
                    </IconButton>
                  )}
                  {relationship.disconnect && (
                    <IconButton
                      label="Unlink note"
                      disabled={pending}
                      onClick={() =>
                        void mutate(() => relationship.disconnect!(record))
                      }
                    >
                      <UnlinkIcon />
                    </IconButton>
                  )}
                  {collection.canDelete(record.id) && (
                    <ConfirmActionButton
                      actionLabel="Delete"
                      trigger={
                        <IconButton label="Delete note">
                          <Trash2Icon />
                        </IconButton>
                      }
                      title="Delete note?"
                      description="This permanently deletes the note from every linked record."
                      onConfirm={() => collection.deleteRecords([record.id])}
                    />
                  )}
                </>
              }
            />
          </li>
        ))}
      </ol>
      {collection.records.length === 0 && !collection.error && (
        <p className="py-4 text-sm text-muted-foreground">
          {collection.loading
            ? "Loading notes…"
            : filters.length > 0
              ? "No notes match your filters."
              : "No notes yet."}
        </p>
      )}
      {collection.hasNextPage && (
        <Button
          variant="ghost"
          disabled={collection.loading}
          onClick={collection.nextPage}
        >
          Load more notes
        </Button>
      )}
      {editing && (
        <ObjectRecordDialog
          mode="edit"
          object={Note}
          open
          record={editing}
          referenceLabels={collection.referenceLabels}
          onOpenChange={(open) => {
            if (!open) setEditing(undefined)
          }}
          onSave={(input) => collection.update(editing, input)}
        />
      )}
    </section>
  )
}

function NoteComposer({ relationship }: RelationshipOverviewProps) {
  const runtime = useModelRuntime()
  const options = relationship.creates[0]!.options
  const [defaultValues] = useState(() =>
    objectFormDefaultValues(
      runtime,
      Note,
      "create",
      undefined,
      new Date(),
      options.initialValues
    )
  )
  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: ({ value }) => {
        try {
          decodeObjectForm(runtime, Note, value, "create")
        } catch (cause) {
          return formErrorFromCause(cause, "Write a note before posting.")
        }
        return undefined
      },
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        await clientFor(runtime, Note).create!(
          decodeObjectForm(runtime, Note, value, "create")
        )
        formApi.reset()
      } catch (cause) {
        formApi.setErrorMap({
          onSubmit: formErrorFromCause(
            cause,
            "Could not post the note. Your draft is still here."
          ),
        })
      }
    },
  })
  return (
    <form.AppForm>
      <form
        aria-label="New note"
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(pending) => (
            <fieldset disabled={pending}>
              <form.AppField name="content">
                {(field) => (
                  <field.FormField
                    id="note-composer-content"
                    label="Write a note"
                  >
                    {({
                      value,
                      onValueChange,
                      onBlur,
                      invalid,
                      ariaDescribedBy,
                    }) => (
                      <MarkdownEditor
                        id="note-composer-content"
                        name="content"
                        placeholder="Share an update, decision, or next step…"
                        value={typeof value === "string" ? value : ""}
                        onValueChange={onValueChange}
                        onBlur={onBlur}
                        aria-invalid={invalid}
                        aria-describedby={ariaDescribedBy}
                        maxLength={10_000}
                        className="min-h-24"
                        rows={3}
                      />
                    )}
                  </field.FormField>
                )}
              </form.AppField>
            </fieldset>
          )}
        </form.Subscribe>
        <form.Subscribe selector={(state) => state.errors}>
          {(errors) => <FieldError errors={formErrorMessages(errors)} />}
        </form.Subscribe>
        <div className="flex justify-end">
          <form.FormSubmitButton pendingChildren="Posting…">
            Post note
          </form.FormSubmitButton>
        </div>
      </form>
    </form.AppForm>
  )
}
