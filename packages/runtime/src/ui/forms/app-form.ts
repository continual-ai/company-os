import { createFormHook } from "@tanstack/react-form"

import { fieldContext, formContext } from "#/ui/forms/form-context.ts"
import { FormField } from "#/ui/forms/form-field.tsx"
import { FormSubmitButton } from "#/ui/forms/form-submit-button.tsx"

/** Application form hook with the standard field and submission presentation. */
export const { useAppForm, useTypedAppFormContext } = createFormHook({
  fieldComponents: { FormField },
  formComponents: { FormSubmitButton },
  fieldContext,
  formContext,
})
