import { Button } from "#/runtime/ui/components/button.tsx"
import { useFormContext } from "#/runtime/ui/forms/form-context.ts"

export function FormSubmitButton({
  children,
  disabled,
  pendingChildren,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "type"> & {
  readonly pendingChildren: React.ReactNode
}) {
  const form = useFormContext()
  return (
    <form.Subscribe
      selector={({ canSubmit, isSubmitting, isValidating }) => ({
        canSubmit,
        isSubmitting,
        isValidating,
      })}
    >
      {({ canSubmit, isSubmitting, isValidating }) => (
        <Button
          {...props}
          type="submit"
          disabled={disabled || !canSubmit || isSubmitting || isValidating}
        >
          {isSubmitting ? pendingChildren : children}
        </Button>
      )}
    </form.Subscribe>
  )
}
