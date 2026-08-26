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

export function CompanyIdentity({
  className,
  markClassName,
}: {
  className?: string | undefined
  markClassName?: string | undefined
}) {
  const logo = companyConfig.brand.logo

  if (logo) {
    return (
      <img
        alt={logo.alt}
        src={logo.src}
        className={cn("h-9 max-w-56 object-contain object-left", className)}
      />
    )
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <CompanyMark className={markClassName} />
      <span className="text-sm font-semibold">
        {companyConfig.identity.productName}
      </span>
    </div>
  )
}

export function CompanySignInMedia({
  className,
}: {
  className?: string | undefined
}) {
  const media = companyConfig.brand.signInMedia

  if (!media) return null

  if (media.kind === "image") {
    return (
      <img
        alt={media.alt}
        src={media.src}
        className={cn("size-full object-cover", className)}
      />
    )
  }

  return (
    <>
      <img
        aria-hidden="true"
        alt=""
        src={media.poster}
        className={cn("size-full object-cover", className)}
      />
      <video
        aria-hidden="true"
        autoPlay
        loop
        muted
        playsInline
        poster={media.poster}
        preload="metadata"
        src={media.src}
        className={cn(
          "absolute inset-0 size-full object-cover motion-reduce:hidden",
          className
        )}
      />
    </>
  )
}
