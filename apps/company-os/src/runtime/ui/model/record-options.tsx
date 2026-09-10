import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@company/ui/alert-dialog"
import { Button } from "@company/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@company/ui/dropdown-menu"
import { toast } from "@company/ui/toast"
import { useMutation } from "@tanstack/react-query"
import { CopyIcon, EllipsisIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"

export function RecordOptions({
  value,
  label,
  objectName,
  onDelete,
}: {
  readonly value: string
  readonly label: string
  readonly objectName: string
  readonly onDelete?: (() => Promise<void>) | undefined
}) {
  const [open, setOpen] = useState(false)
  const deletion = useMutation({
    mutationFn: async () => {
      if (!onDelete) throw new Error("Deletion is not available.")
      await onDelete()
    },
    onSuccess: () => setOpen(false),
  })
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Record options"
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              void navigator.clipboard.writeText(value).then(
                () => toast.success("Record ID copied"),
                () => toast.error("Could not copy record ID")
              )
            }}
          >
            <CopyIcon />
            Copy record ID
          </DropdownMenuItem>
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  deletion.reset()
                  setOpen(true)
                }}
              >
                <Trash2Icon />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!deletion.isPending) setOpen(next)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {objectName.toLowerCase()}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes “{label}” and its links. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deletion.error && (
            <p role="alert" className="text-xs text-destructive">
              {deletion.error.message}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletion.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deletion.isPending}
              onClick={() => deletion.mutate()}
            >
              {deletion.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
