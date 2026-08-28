import { createFormHook } from "@tanstack/react-form"

import { fieldContext, formContext } from "./form-context"
import { FormField } from "./form-field"
import { FormSubmitButton } from "./form-submit-button"

/** Application form hook with the standard field and submission presentation. */
export const { useAppForm, useTypedAppFormContext } = createFormHook({
  fieldComponents: { FormField },
  formComponents: { FormSubmitButton },
  fieldContext,
  formContext,
})
