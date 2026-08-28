import { cn } from "@company/ui/lib/utils"

import { applicationConfig } from "@/customization/config"

export function BrandMark({ className }: { className?: string | undefined }) {
  const mark = applicationConfig.brand.mark

  if (mark) {
    return (
      <img
        alt={mark.alt}
        src={mark.src}
        className={cn("size-9 shrink-0 object-contain", className)}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center bg-primary text-sm font-semibold text-primary-foreground",
        className
      )}
    >
      {applicationConfig.identity.monogram}
    </span>
  )
}
