import { cn } from "@company/ui/lib/utils"
import { PageContent } from "@company/ui/page"

export function SettingsPage({
  description,
  children,
}: {
  description: string
  children: React.ReactNode
}) {
  return (
    <PageContent className="mx-auto w-full max-w-3xl">
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      <div className="space-y-6">{children}</div>
    </PageContent>
  )
}

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-medium">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="rounded-lg border border-border/60 bg-card px-4">
        {children}
      </div>
    </section>
  )
}

export function SettingsRow({
  title,
  description,
  children,
  className,
}: {
  title: string
  description: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-16 flex-col gap-3 border-b border-border/50 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="max-w-xl min-w-0">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  )
}
