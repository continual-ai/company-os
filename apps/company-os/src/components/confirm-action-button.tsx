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
} from "@company/ui/components/alert-dialog"
import { Button } from "@company/ui/components/button"
import { useState } from "react"

export function ConfirmActionButton({
  actionLabel,
  description,
  destructive = true,
  onConfirm,
  title,
}: {
  readonly actionLabel: string
  readonly description: string
  readonly destructive?: boolean
  readonly onConfirm: () => Promise<void>
  readonly title: string
}) {
  const [error, setError] = useState<string>()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button size="xs" variant="ghost" />}>
        {actionLabel}
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
