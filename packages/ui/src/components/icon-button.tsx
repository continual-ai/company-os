import type { ComponentProps } from "react"

import { Button } from "#/components/button.tsx"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "#/components/tooltip.tsx"

/** Compact actions share a hit target, accessible name, and visible tooltip. */
export function IconButton({
  label,
  children,
  size = "icon-xs",
  variant = "ghost",
  ...props
}: Omit<ComponentProps<typeof Button>, "size" | "aria-label"> & {
  label: string
  size?: "icon-xs" | "icon-sm" | "icon" | "icon-lg"
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button {...props} size={size} variant={variant} aria-label={label} />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
