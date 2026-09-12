import { Button } from "@company/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@company/ui/dialog"
import { FieldError } from "@company/ui/field"
import { useMutation } from "@tanstack/react-query"
import { useState } from "react"

import type { Action, ObjectType } from "#/runtime/model/index.ts"
import { useAppForm } from "#/runtime/ui/forms/app-form.ts"
import {
  formErrorFromCause,
  formErrorMessages,
} from "#/runtime/ui/forms/form-errors.ts"
import { SchemaFormField } from "#/runtime/ui/forms/schema-form-field.tsx"
import {
  decodeOperationForm,
  operationFormDefaults,
  operationFormFields,
} from "#/runtime/ui/model/operation-form.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"
import { useOperationClient } from "#/runtime/ui/model/use-operation-client.ts"

const noReferenceLabels = new Map<string, string>()
function ActionForm({
  action,
  recordId,
  onComplete,
  onPendingChange,
}: {
  readonly action: Action
  readonly recordId?: string | undefined
  readonly onPendingChange: (pending: boolean) => void
  readonly onComplete: () => void
}) {
  const mutation = useMutation(useOperationClient(action)())
  const form = useAppForm({
    defaultValues: operationFormDefaults(action, recordId),
    validators: {
      onSubmit: ({ value }) => {
        try {
          decodeOperationForm(action, value, recordId)
          return undefined
        } catch (cause) {
          return formErrorFromCause(cause, "Check the highlighted fields.")
        }
      },
    },
    onSubmit: async ({ value, formApi }) => {
      onPendingChange(true)
      try {
        await mutation.mutateAsync(decodeOperationForm(action, value, recordId))
        onComplete()
      } catch (cause) {
        formApi.setErrorMap({
          onSubmit: formErrorFromCause(cause, "The operation failed."),
        })
      } finally {
        onPendingChange(false)
      }
    },
  })
  return (
    <form.AppForm>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <DialogHeader>
          <DialogTitle>{action.name}</DialogTitle>
          <DialogDescription>{action.description}</DialogDescription>
        </DialogHeader>
        {operationFormFields(action, recordId).map(
          ({ id, schema, required }) => (
            <SchemaFormField
              key={id}
              json
              id={id}
              schema={schema}
              required={required}
              fieldId={`${action.key}-${id}`}
              referenceLabels={noReferenceLabels}
            />
          )
        )}
        <form.Subscribe selector={({ errors }) => errors}>
          {(errors) => <FieldError errors={formErrorMessages(errors)} />}
        </form.Subscribe>
        <form.FormSubmitButton pendingChildren="Running…">
          {action.name}
        </form.FormSubmitButton>
      </form>
    </form.AppForm>
  )
}

/** A definition is enough for a module page to offer any Action, including a global one. */
export function OperationAction({
  action,
  recordId,
}: {
  readonly action: Action
  readonly recordId?: string | undefined
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  return (
    <>
      <Button
        variant={action.destructive ? "destructive" : "outline"}
        size="sm"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        {action.name}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {open && (
            <ActionForm
              action={action}
              recordId={recordId}
              onPendingChange={setPending}
              onComplete={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Custom UI overrides replace individual actions; all other installed actions get a schema form. */
export function ModelActions({
  object,
  recordId,
  exclude = [],
}: {
  readonly object: ObjectType
  readonly recordId?: string | undefined
  readonly exclude?: ReadonlyArray<string>
}) {
  const { model } = useModelRuntime()
  return (
    <>
      {Object.values(model.actions)
        .filter(
          (action): action is Action =>
            "input" in action &&
            action.objectType === object.id &&
            action.scope ===
              (recordId === undefined ? "collection" : "object") &&
            !exclude.includes(action.id)
        )
        .map((action) => (
          <OperationAction
            key={action.key}
            action={action}
            recordId={recordId}
          />
        ))}
    </>
  )
}
