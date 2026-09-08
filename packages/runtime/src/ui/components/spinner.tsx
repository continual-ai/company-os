import { LoaderCircleIcon } from "lucide-react"
import * as React from "react"

import { cn } from "#/ui/lib/utils.ts"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <LoaderCircleIcon
      data-slot="spinner"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
