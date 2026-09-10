import type { ComponentProps, ReactNode } from "react"

import { cn } from "#/lib/utils.ts"

/** The header owns its gutter and the seam between navigation and content. */
function PageHeader({
  className,
  children,
  navigation,
  ...props
}: ComponentProps<"header"> & { navigation?: ReactNode }) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "flex shrink-0 flex-col gap-4 border-b bg-background p-page-gutter",
        navigation && "pb-0",
        className
      )}
      {...props}
    >
      {children}
      {navigation && (
        <div
          data-slot="page-navigation"
          className="-mb-px flex min-w-0 items-center gap-2"
        >
          {navigation}
        </div>
      )}
    </header>
  )
}

function PageToolbar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="page-toolbar"
      className={cn(
        "flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b px-page-gutter py-1",
        className
      )}
      {...props}
    />
  )
}

/** Own the outer padding once, whether this is a whole page or one split panel. */
function PageContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="page-body"
      className={cn("min-w-0 space-y-6 p-page-gutter", className)}
      {...props}
    />
  )
}

function PageSectionHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="page-section-header"
      className={cn(
        "mb-2 flex min-h-8 items-center justify-between gap-2",
        className
      )}
      {...props}
    />
  )
}

export { PageHeader, PageToolbar, PageContent, PageSectionHeader }
