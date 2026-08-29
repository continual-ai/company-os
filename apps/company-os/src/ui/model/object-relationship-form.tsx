import { Model } from "@company/model"
import type { ModelLinkTraversal } from "@company/runtime"
import { FieldError } from "@company/ui/components/field"
import { PlusIcon } from "lucide-react"
import { useRef } from "react"

import { useAppForm } from "@/ui/forms/app-form"
import {
  focusFirstFormError,
  formErrorFromCause,
  formErrorFromViolations,
  formErrorMessages,
} from "@/ui/forms/form-errors"

import type { DynamicLinkClient } from "./object-client"
import { stringValue } from "./object-form"
import { ObjectReferenceSelect } from "./object-reference-select"

function targetTypeName(typeId: string): string {
  if (typeId === Model.root.id) return Model.root.name
  const object = Object.values(Model.objects).find(({ id }) => id === typeId)
  if (object !== undefined) return object.name
  return (
    Object.values(Model.interfaces).find(({ id }) => id === typeId)?.name ??
    "record"
  )
}

export function ObjectRelationshipForm({
  link,
  onLinked,
  recordId,
  traversal,
}: {
  readonly link: NonNullable<DynamicLinkClient["link"]>
  readonly onLinked: () => Promise<void>
  readonly recordId: string
  readonly traversal: ModelLinkTraversal
}) {
  const formElement = useRef<HTMLFormElement>(null)
  const targetName = targetTypeName(traversal.target.from.typeId)
  const fieldId = `${recordId}-${traversal.traversal.key}-target`
  const form = useAppForm({
    defaultValues: { target: "" },
    validators: {
      onSubmit: ({ value }) =>
        value.target.trim() === ""
          ? formErrorFromViolations([
              {
                message: `${targetName} is required.`,
                path: ["target"],
                reason: "REQUIRED",
              },
            ])
          : undefined,
    },
    onSubmitInvalid: () => focusFirstFormError(formElement.current),
    onSubmit: async ({ formApi, value }) => {
      try {
        await link({ id: recordId, target: value.target.trim() })
        formApi.reset()
        await onLinked()
      } catch (cause) {
        formApi.setErrorMap({
          onSubmit: formErrorFromCause(
            cause,
            `${traversal.traversal.label} could not be linked.`
          ),
        })
        focusFirstFormError(formElement.current)
        throw cause
      }
    },
  })

  return (
    <form.AppForm>
      <form
        ref={formElement}
        noValidate
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit().catch(() => undefined)
        }}
      >
        <form.AppField name="target">
          {(field) => (
            <field.FormField
              id={fieldId}
              label={`Add ${targetName.toLowerCase()}`}
            >
              {({ ariaDescribedBy, invalid, onBlur, onValueChange, value }) => (
                <ObjectReferenceSelect
                  ariaDescribedBy={ariaDescribedBy}
                  id={fieldId}
                  invalid={invalid}
                  name="target"
                  required
                  typeId={traversal.target.from.typeId}
                  value={stringValue(value)}
                  onBlur={onBlur}
                  onValueChange={onValueChange}
                />
              )}
            </field.FormField>
          )}
        </form.AppField>
        <form.Subscribe selector={({ errors }) => errors}>
          {(errors) => <FieldError errors={formErrorMessages(errors)} />}
        </form.Subscribe>
        <form.FormSubmitButton
          size="sm"
          pendingChildren={
            <>
              <PlusIcon />
              Linking…
            </>
          }
        >
          <PlusIcon />
          Link
        </form.FormSubmitButton>
      </form>
    </form.AppForm>
  )
}
