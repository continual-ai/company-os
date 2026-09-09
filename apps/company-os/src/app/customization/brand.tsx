import { appConfig } from "#/app/customization/config.ts"
import { cn } from "#/runtime/ui/lib/utils.ts"

export function BrandMark({ className }: { className?: string | undefined }) {
  const mark = appConfig.brand.mark

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
      {appConfig.identity.monogram}
    </span>
  )
}
