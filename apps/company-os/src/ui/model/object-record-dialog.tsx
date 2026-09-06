import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@company/ui/components/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@company/ui/components/dialog"
import { FieldError } from "@company/ui/components/field"
import { useMemo, useRef, useState } from "react"

import { useAppForm } from "@/ui/forms/app-form"
import {
  focusFirstFormError,
  formErrorFromCause,
  formErrorMessages,
} from "@/ui/forms/form-errors"

import { useObjectUi } from "./module-ui"
import type { ClientRecord, ModelObject } from "./object-client"
import {
  decodeObjectForm,
  isSupportedFormSchema,
  objectFormDefaultValues,
  objectFormProperties,
  type ObjectFormInput,
  type ObjectFormMode,
} from "./object-form"
import { ObjectFormFields } from "./object-form-fields"

function ObjectRecordEditor({
  mode,
  initialValues,
  object,
  onOpenChange,
  onSave,
  open,
  record,
  referenceLabels,
}: {
  readonly initialValues?: ObjectFormInput | undefined
  readonly mode: ObjectFormMode
  readonly object: ModelObject
  readonly onOpenChange: (open: boolean) => void
  readonly onSave: (input: ObjectFormInput) => Promise<void>
  readonly open: boolean
  readonly record?: ClientRecord | undefined
  readonly referenceLabels: ReadonlyMap<string, string>
}) {
  const [initialRecord] = useState(record)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const ui = useObjectUi(object)
  const unsupported = objectFormProperties(object, mode).filter(
    ({ schema }) => !isSupportedFormSchema(schema)
  )
  const formElement = useRef<HTMLFormElement>(null)
  const defaultValues = useMemo(
    () =>
      objectFormDefaultValues(
        object,
        mode,
        initialRecord,
        new Date(),
        initialValues
      ),
    [mode, object, initialRecord, initialValues]
  )
  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: ({ value }) => {
        try {
          decodeObjectForm(object, value, mode)
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
          ...decodeObjectForm(object, value, mode),
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

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (form.state.isSubmitting) return
          if (!nextOpen && form.state.isDirty) setConfirmDiscard(true)
          else onOpenChange(nextOpen)
        }}
      >
        <DialogContent
          className="max-h-[85vh] overflow-y-auto sm:max-w-lg"
          initialFocus={() =>
            formElement.current?.querySelector<HTMLInputElement>(
              `[name="${object.display.title}"]`
            ) ?? true
          }
        >
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
                    ? `New ${object.name}`
                    : `Edit ${object.name}`}
                </DialogTitle>
                <DialogDescription>{object.description}</DialogDescription>
              </DialogHeader>
              <ObjectFormFields
                fieldEditors={ui?.fieldEditors}
                mode={mode}
                object={object}
                record={initialRecord}
                referenceLabels={referenceLabels}
              />
              <form.Subscribe selector={({ errors }) => errors}>
                {(errors) => <FieldError errors={formErrorMessages(errors)} />}
              </form.Subscribe>
              <DialogFooter>
                <form.FormSubmitButton
                  disabled={unsupported.length > 0}
                  pendingChildren="Saving…"
                >
                  Save
                </form.FormSubmitButton>
              </DialogFooter>
            </form>
          </form.AppForm>
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
