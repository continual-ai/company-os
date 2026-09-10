import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@company/ui/alert-dialog"
import { Button } from "@company/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@company/ui/dialog"
import { FieldError } from "@company/ui/field"
import { useCallback, useMemo, useRef, useState } from "react"

import { useAppForm } from "#/runtime/ui/forms/app-form.ts"
import {
  focusFirstFormError,
  formErrorFromCause,
  formErrorMessages,
} from "#/runtime/ui/forms/form-errors.ts"
import { useObjectUi } from "#/runtime/ui/model/module-ui.tsx"
import {
  modelObjectProperty,
  type ClientRecord,
  type ModelObject,
} from "#/runtime/ui/model/object-client.ts"
import { ObjectFormFields } from "#/runtime/ui/model/object-form-fields.tsx"
import {
  decodeObjectForm,
  isSupportedFormSchema,
  objectFormDefaultValues,
  objectFormProperties,
  type ObjectFormInput,
  type ObjectFormMode,
} from "#/runtime/ui/model/object-form.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

function ObjectRecordEditor({
  mode,
  fields,
  initialValues,
  object,
  onOpenChange,
  onSave,
  open,
  record,
  referenceLabels,
}: {
  readonly fields?: ReadonlyArray<string> | undefined
  readonly initialValues?: ObjectFormInput | undefined
  readonly mode: ObjectFormMode
  readonly object: ModelObject
  readonly onOpenChange: (open: boolean) => void
  readonly onSave: (input: ObjectFormInput) => Promise<void>
  readonly open: boolean
  readonly record?: ClientRecord | undefined
  readonly referenceLabels: ReadonlyMap<string, string>
}) {
  const runtime = useModelRuntime()

  const [initialRecord] = useState(record)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const ui = useObjectUi(object)
  const unsupported = objectFormProperties(object, mode).filter(
    ({ id, schema }) =>
      (fields === undefined || fields.includes(id)) &&
      !isSupportedFormSchema(schema)
  )
  const formElement = useRef<HTMLFormElement>(null)
  const defaultValues = useMemo(
    () =>
      objectFormDefaultValues(
        runtime,
        object,
        mode,
        initialRecord,
        new Date(),
        initialValues
      ),
    [runtime, mode, object, initialRecord, initialValues]
  )
  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: ({ value }) => {
        try {
          decodeObjectForm(runtime, object, value, mode, fields)
          return undefined
        } catch (cause) {
          return formErrorFromCause(cause, "Check the highlighted fields.")
        }
      },
    },
    onSubmitInvalid: () => focusFirstFormError(formElement.current),
    onSubmit: async ({ formApi, value }) => {
      try {
        await onSave({
          ...decodeObjectForm(runtime, object, value, mode, fields),
          ...(mode === "edit" && initialRecord !== undefined
            ? { etag: initialRecord.etag }
            : {}),
        })
        onOpenChange(false)
      } catch (cause) {
        formApi.setErrorMap({
          onSubmit: formErrorFromCause(cause, "The operation failed."),
        })
        focusFirstFormError(formElement.current)
        throw cause
      }
    },
  })

  const requestClose = useCallback(
    (nextOpen: boolean) => {
      if (form.state.isSubmitting) return
      if (!nextOpen && form.state.isDirty) setConfirmDiscard(true)
      else onOpenChange(nextOpen)
    },
    [form, onOpenChange]
  )
  const content = (
    <form.AppForm>
      <form
        ref={formElement}
        noValidate
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit().catch(() => undefined)
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? `New ${object.name.toLowerCase()}`
              : fields?.length === 1
                ? `Edit ${(modelObjectProperty(object, fields[0]!)?.label ?? fields[0]!).replace(/^[A-Z](?=[a-z])/, (letter) => letter.toLowerCase())}`
                : `Edit ${object.name.toLowerCase()}`}
          </DialogTitle>
          {mode === "create" && object.description && (
            <DialogDescription className="line-clamp-2">
              {object.description}
            </DialogDescription>
          )}
        </DialogHeader>
        <ObjectFormFields
          fields={fields}
          fieldEditors={ui?.fieldEditors}
          mode={mode}
          object={object}
          record={initialRecord}
          referenceLabels={referenceLabels}
        />
        <form.Subscribe selector={({ errors }) => errors}>
          {(errors) => <FieldError errors={formErrorMessages(errors)} />}
        </form.Subscribe>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => requestClose(false)}
          >
            Cancel
          </Button>
          <form.FormSubmitButton
            disabled={unsupported.length > 0}
            pendingChildren="Saving…"
          >
            Save
          </form.FormSubmitButton>
        </div>
      </form>
    </form.AppForm>
  )
  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent
          className="max-h-[85vh] overflow-y-auto sm:max-w-lg"
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault()
              if (!form.state.isSubmitting) formElement.current?.requestSubmit()
            }
          }}
          initialFocus={() =>
            formElement.current?.querySelector<HTMLInputElement>(
              `[name="${fields?.[0] ?? object.display.title}"]`
            ) ?? true
          }
        >
          {content}
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your changes have not been saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => onOpenChange(false)}>
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** An open editor owns its draft and starting version until dismissed. */
export function ObjectRecordDialog(
  props: Parameters<typeof ObjectRecordEditor>[0]
) {
  return props.open ? (
    <ObjectRecordEditor
      key={`${props.object.id}:${props.mode}:${props.record?.id ?? "new"}`}
      {...props}
    />
  ) : null
}
