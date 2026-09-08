import { CopyIcon, EllipsisIcon } from "lucide-react"

import { Button } from "#/ui/components/button.tsx"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "#/ui/components/dropdown-menu.tsx"
import { toast } from "#/ui/components/toast.tsx"

export function RecordIdentifier({ value }: { readonly value: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Record options" />
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
