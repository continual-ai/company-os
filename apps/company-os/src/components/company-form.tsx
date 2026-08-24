import { Button } from "@company/ui/components/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@company/ui/components/field"
import { Input } from "@company/ui/components/input"
import { cn } from "@company/ui/lib/utils"
import { createFormHook, createFormHookContexts } from "@tanstack/react-form"
import { CheckIcon, CircleAlertIcon, LoaderCircleIcon } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"

const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts()

type FieldLayout = "settings" | "stacked"

type TextFieldProps = {
  description?: string
  input?: Omit<
    React.ComponentProps<typeof Input>,
    "name" | "onBlur" | "onChange" | "value"
  >
  label: string
  layout?: FieldLayout
}

// TanStack Form intentionally exposes validator errors as unknown values.
// oxlint-disable-next-line anti-slop/no-runtime-typeof
function fieldErrors(errors: unknown[]): Array<{ message: string }> {
  return errors.flatMap((error) => {
    // oxlint-disable-next-line anti-slop/no-runtime-typeof
    if (typeof error === "string") return [{ message: error }]
    if (
      // oxlint-disable-next-line anti-slop/no-runtime-typeof
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      // oxlint-disable-next-line anti-slop/no-runtime-typeof
      typeof error.message === "string"
    ) {
      return [{ message: error.message }]
    }
    return []
  })
}

function fieldLayout(layout: FieldLayout) {
  return layout === "settings"
    ? {
        control: "relative w-full shrink-0 sm:w-64 group-last/field:border-b-0",
        field:
          "min-h-16 flex-col border-b border-border/50 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between",
      }
    : {
        control: "relative w-full",
        field: "flex-col",
      }
}

function TextField({
  description,
  input,
  label,
  layout = "stacked",
}: TextFieldProps) {
  const field = useFieldContext<string>()
  const generatedId = useId()
  const inputId = input?.id ?? generatedId
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
  const styles = fieldLayout(layout)

  return (
    <Field data-invalid={isInvalid} className={styles.field}>
      <FieldContent>
        <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
        {description ? (
          <FieldDescription>{description}</FieldDescription>
        ) : null}
        {isInvalid ? (
          <FieldError errors={fieldErrors(field.state.meta.errors)} />
        ) : null}
      </FieldContent>
      <div className={styles.control}>
        <Input
          {...input}
          id={inputId}
          name={field.name}
          value={field.state.value}
          aria-invalid={isInvalid}
          onBlur={field.handleBlur}
          onChange={(event) => field.handleChange(event.target.value)}
        />
      </div>
    </Field>
  )
}

type SaveStatus = "error" | "idle" | "invalid" | "saved" | "saving"

type AutoSaveTextFieldProps = TextFieldProps & {
  committedValue: string
  normalize?: (value: string) => string
  onCommit: (value: string) => Promise<void> | void
}

function AutoSaveTextField({
  committedValue,
  description,
  input,
  label,
  layout = "stacked",
  normalize = (value) => value,
  onCommit,
}: AutoSaveTextFieldProps) {
  const field = useFieldContext<string>()
  const generatedId = useId()
  const inputId = input?.id ?? generatedId
  const [focused, setFocused] = useState(false)
  const [status, setStatus] = useState<SaveStatus>("idle")
  const clearTimer = useRef<number | null>(null)
  const commitVersion = useRef(0)
  const styles = fieldLayout(layout)
  const isInvalid =
    !focused &&
    (status === "error" ||
      status === "invalid" ||
      (field.state.meta.isTouched && !field.state.meta.isValid))

  const clearStatusTimer = () => {
    if (clearTimer.current !== null) {
      window.clearTimeout(clearTimer.current)
      clearTimer.current = null
    }
  }

  useEffect(() => {
    return () => {
      commitVersion.current += 1
      if (clearTimer.current !== null) window.clearTimeout(clearTimer.current)
    }
  }, [])

  return (
    <Field data-invalid={isInvalid} className={styles.field}>
      <FieldContent>
        <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
        {description ? (
          <FieldDescription>{description}</FieldDescription>
        ) : null}
        {isInvalid ? (
          <FieldError errors={fieldErrors(field.state.meta.errors)}>
            {status === "error" ? "Could not save this value." : undefined}
          </FieldError>
        ) : null}
      </FieldContent>
      <div className={styles.control}>
        <Input
          {...input}
          id={inputId}
          name={field.name}
          value={field.state.value}
          aria-invalid={isInvalid}
          className={cn("pr-8", input?.className)}
          onFocus={() => {
            commitVersion.current += 1
            clearStatusTimer()
            setFocused(true)
            setStatus("idle")
          }}
          onChange={(event) => {
            commitVersion.current += 1
            clearStatusTimer()
            field.handleChange(event.target.value)
            setStatus("idle")
          }}
          onBlur={() => {
            setFocused(false)
            field.handleBlur()
            const version = commitVersion.current + 1
            commitVersion.current = version

            void (async () => {
              const errors = await field.validate("blur")
              if (version !== commitVersion.current) return
              if (errors.length > 0) {
                setStatus("invalid")
                return
              }

              const value = normalize(field.state.value)
              if (value === committedValue) {
                field.handleChange(value)
                setStatus("idle")
                return
              }

              setStatus("saving")
              try {
                await Promise.all([
                  onCommit(value),
                  new Promise((resolve) => window.setTimeout(resolve, 300)),
                ])
                if (version !== commitVersion.current) return
                field.handleChange(value)
                setStatus("saved")
                clearTimer.current = window.setTimeout(
                  () => setStatus("idle"),
                  1400
                )
              } catch {
                if (version === commitVersion.current) setStatus("error")
              }
            })()
          }}
        />
        <output
          aria-live="polite"
          className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-muted-foreground"
        >
          {!focused && status === "saving" ? (
            <>
              <LoaderCircleIcon
                aria-hidden="true"
                className="size-3.5 animate-spin"
              />
              <span className="sr-only">Saving</span>
            </>
          ) : null}
          {!focused && status === "saved" ? (
            <>
              <CheckIcon
                aria-hidden="true"
                className="size-3.5 text-foreground"
              />
              <span className="sr-only">Saved</span>
            </>
          ) : null}
          {!focused && (status === "invalid" || status === "error") ? (
            <>
              <CircleAlertIcon
                aria-hidden="true"
                className="size-3.5 text-destructive"
              />
              <span className="sr-only">
                {status === "error" ? "Save failed" : "Invalid"}
              </span>
            </>
          ) : null}
        </output>
      </div>
    </Field>
  )
}

function FormRoot({
  children,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit">) {
  const form = useFormContext()

  return (
    <form
      {...props}
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      {children}
    </form>
  )
}

function SubmitButton({ children = "Save" }: { children?: React.ReactNode }) {
  const form = useFormContext()

  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(isSubmitting) => (
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : children}
        </Button>
      )}
    </form.Subscribe>
  )
}

const companyForm = createFormHook({
  fieldComponents: { AutoSaveTextField, TextField },
  fieldContext,
  formComponents: { FormRoot, SubmitButton },
  formContext,
})

export const useCompanyForm = companyForm.useAppForm
