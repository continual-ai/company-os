import type { ComponentType, ReactNode } from "react"

export interface ComponentSection {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly usage: string
  readonly component: ComponentType
}

export function Example({
  title,
  source,
  children,
}: {
  title: string
  source: string
  children: ReactNode
}) {
  return (
    <section className="min-w-0 space-y-4">
      <header>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
          {source}
        </p>
      </header>
      <div className="min-w-0 rounded-lg border bg-background p-5">
        {children}
      </div>
    </section>
  )
}
