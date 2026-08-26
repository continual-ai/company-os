import { Button } from "@company/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@company/ui/components/dialog"
import { FieldError } from "@company/ui/components/field"

import type { ClientRecord, ModelObject } from "./object-client"
import {
  decodeObjectForm,
  isSupportedFormSchema,
  objectFormProperties,
  type ObjectFormInput,
  type ObjectFormMode,
} from "./object-form"
import { ObjectFormFields } from "./object-form-fields"
import { useFormSubmission } from "./use-form-submission"

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
  const submission = useFormSubmission({
    fallback: "The operation failed.",
    onSubmit: async (data) => {
      const input = decodeObjectForm(object, data, mode)
      await onSave(input)
      onOpenChange(false)
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) submission.resetErrors()
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <form
          noValidate
          className="grid gap-4"
          onInput={submission.handleInput}
          onSubmit={submission.handleSubmit}
        >
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? `New ${object.name}` : `Edit ${object.name}`}
            </DialogTitle>
            <DialogDescription>{object.description}</DialogDescription>
          </DialogHeader>
          <ObjectFormFields
            mode={mode}
            object={object}
            record={record}
            referenceLabels={referenceLabels}
            errors={submission.errors}
          />
          <FieldError errors={submission.errors.form} />
          <DialogFooter>
            <Button
              type="submit"
              disabled={submission.pending || unsupported.length > 0}
            >
              {submission.pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
