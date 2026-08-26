import { cn } from "@company/ui/lib/utils"

import { companyConfig } from "@/company/config"

export function CompanyMark({ className }: { className?: string | undefined }) {
  const mark = companyConfig.brand.mark

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
      {companyConfig.identity.monogram}
    </span>
  )
}
