import { buttonVariants } from "#/runtime/ui/components/button.tsx"
import { useIsMobile } from "#/runtime/ui/hooks/use-mobile.ts"
import { cn } from "#/runtime/ui/lib/utils.ts"

export function Badge() {
  return cn(buttonVariants(), String(useIsMobile))
}
