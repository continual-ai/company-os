import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@company/ui/components/dialog"
import { FieldError } from "@company/ui/components/field"
import { useEffect, useMemo, useRef } from "react"

import { useAppForm } from "@/ui/forms/app-form"
import {
  focusFirstFormError,
  formErrorFromCause,
  formErrorMessages,
} from "@/ui/forms/form-errors"

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

export function ObjectRecordDialog({
  mode,
  object,
  onOpenChange,
  onSave,
  open,
  record,
  referenceLabels,
}: {
  readonly mode: ObjectFormMode
  readonly object: ModelObject
  readonly onOpenChange: (open: boolean) => void
  readonly onSave: (input: ObjectFormInput) => Promise<void>
  readonly open: boolean
  readonly record?: ClientRecord | undefined
  readonly referenceLabels: ReadonlyMap<string, string>
}) {
  const unsupported = objectFormProperties(object, mode).filter(
    ({ schema }) => !isSupportedFormSchema(schema)
  )
  const formElement = useRef<HTMLFormElement>(null)
  const defaultValues = useMemo(
    () => objectFormDefaultValues(object, mode, record),
    [mode, object, record]
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
        await onSave(decodeObjectForm(object, value, mode))
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

  useEffect(() => form.reset(defaultValues), [defaultValues, form])

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) form.reset(defaultValues)
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
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
              mode={mode}
              object={object}
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
  )
}
