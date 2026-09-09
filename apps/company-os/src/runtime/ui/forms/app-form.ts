import { createFormHook } from "@tanstack/react-form"

import { fieldContext, formContext } from "#/runtime/ui/forms/form-context.ts"
import { FormField } from "#/runtime/ui/forms/form-field.tsx"
import { FormSubmitButton } from "#/runtime/ui/forms/form-submit-button.tsx"

/** Application form hook with the standard field and submission presentation. */
export const { useAppForm, useTypedAppFormContext } = createFormHook({
  fieldComponents: { FormField },
  formComponents: { FormSubmitButton },
  fieldContext,
  formContext,
})
