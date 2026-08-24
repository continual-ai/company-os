import { cn } from "@company/ui/lib/utils"

export function SettingsPage({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8 lg:py-10">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </header>
      <div className="mt-10 space-y-10">{children}</div>
    </div>
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
      <div className="rounded-sm border border-border/60 px-4">{children}</div>
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
