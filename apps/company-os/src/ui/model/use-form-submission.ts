import {
  type FormEventHandler,
  type FormEvent,
  useCallback,
  useState,
} from "react"

import {
  emptyFormErrors,
  formErrorsFromCause,
  formErrorsFromViolations,
  nativeFormViolations,
  type FormErrors,
} from "./form-errors"

function focusFirstInvalidField(form: HTMLFormElement, errors: FormErrors) {
  const name = errors.fields.keys().next().value
  if (name === undefined) return
  const control = form.elements.namedItem(name)
  if (
    control instanceof HTMLElement &&
    control.getAttribute("type") !== "hidden"
  ) {
    control.focus()
    return
  }
  const customControl = [
    ...form.querySelectorAll<HTMLElement>("[data-form-field]"),
  ].find((element) => element.dataset.formField === name)
  customControl?.focus()
}

export function useFormSubmission({
  fallback,
  onSubmit,
}: {
  readonly fallback: string
  readonly onSubmit: (data: FormData, form: HTMLFormElement) => Promise<void>
}) {
  const [errors, setErrors] = useState<FormErrors>(emptyFormErrors)
  const [pending, setPending] = useState(false)

  const reportErrors = useCallback(
    (form: HTMLFormElement, nextErrors: FormErrors) => {
      setErrors(nextErrors)
      window.requestAnimationFrame(() =>
        focusFirstInvalidField(form, nextErrors)
      )
    },
    []
  )

  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    if (pending) return
    const form = event.currentTarget
    const nativeViolations = nativeFormViolations(form)
    if (nativeViolations.length > 0) {
      reportErrors(form, formErrorsFromViolations(nativeViolations))
      return
    }

    setPending(true)
    setErrors(emptyFormErrors)
    void onSubmit(new FormData(form), form)
      .catch((cause: unknown) =>
        reportErrors(form, formErrorsFromCause(cause, fallback))
      )
      .finally(() => setPending(false))
  }

  const handleInput = (event: FormEvent<HTMLFormElement>) => {
    const target = event.target
    if (
      !(target instanceof HTMLInputElement) &&
      !(target instanceof HTMLSelectElement) &&
      !(target instanceof HTMLTextAreaElement)
    ) {
      return
    }
    const name = target.name
    if (name === "") return
    setErrors((current) => {
      const fields = new Map(current.fields)
      let changed = false
      for (const field of fields.keys()) {
        if (
          field === name ||
          field.startsWith(`${name}.`) ||
          name.startsWith(`${field}.`)
        ) {
          fields.delete(field)
          changed = true
        }
      }
      if (!changed) return current
      return { ...current, fields }
    })
  }

  return {
    errors,
    handleInput,
    handleSubmit,
    pending,
    resetErrors: () => setErrors(emptyFormErrors),
  } as const
}
