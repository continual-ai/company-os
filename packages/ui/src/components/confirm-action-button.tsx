import { useState, type ReactElement } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "#/components/alert-dialog.tsx"
import { Button } from "#/components/button.tsx"

export function ConfirmActionButton({
  actionLabel,
  description,
  destructive = true,
  onConfirm,
  title,
  trigger,
}: {
  readonly actionLabel: string
  readonly description: string
  readonly destructive?: boolean
  readonly onConfirm: () => Promise<void>
  readonly trigger?: ReactElement
  readonly title: string
}) {
  const [error, setError] = useState<string>()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={trigger ?? <Button size="xs" variant="ghost" />}
      >
        {trigger ? undefined : actionLabel}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error === undefined ? null : (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={() => {
              setPending(true)
              setError(undefined)
              void onConfirm()
                .then(() => setOpen(false))
                .catch((cause: unknown) =>
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "The operation failed."
                  )
                )
                .finally(() => setPending(false))
            }}
          >
            {pending ? "Working…" : actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
