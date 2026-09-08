import { Input } from "@company/ui/components/input"
import { SearchIcon } from "lucide-react"
import type { ReactNode } from "react"

import { DeveloperLayout } from "#/ui/developer/developer-layout.tsx"

export interface DeveloperBrowserStat {
  readonly label: string
  readonly value: number | string
}

export interface DeveloperBrowserOutlineItem {
  readonly count?: number
  readonly href: `#${string}`
  readonly label: string
}

export function DeveloperBrowser({
  actions,
  children,
  description,
  eyebrow,
  sidebar,
  sidebarLabel,
  stats,
  title,
}: {
  actions?: ReactNode
  children: ReactNode
  description: string
  eyebrow: ReactNode
  sidebar: ReactNode
  sidebarLabel: string
  stats: ReadonlyArray<DeveloperBrowserStat>
  title: string
}) {
  return (
    <DeveloperLayout
      sidebar={sidebar}
      sidebarLabel={sidebarLabel}
      header={
        <header className="shrink-0 border-b px-5 py-5 lg:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground [&>svg]:size-4">
                {eyebrow}
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                {title}
              </h1>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 xl:items-end">
              {actions}
              <dl className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                {stats.map((stat) => (
                  <div key={stat.label} className="flex items-baseline gap-1.5">
                    <dd className="font-medium tabular-nums">{stat.value}</dd>
                    <dt className="text-muted-foreground">{stat.label}</dt>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </header>
      }
    >
      {children}
    </DeveloperLayout>
  )
}

export function DeveloperBrowserSearch({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string
  onChange: (value: string) => void
  placeholder: string
  value: string
}) {
  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
      <Input
        aria-label={label}
        className="bg-background pl-8"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

export function DeveloperBrowserEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="border border-dashed px-4 py-8 text-center text-xs text-muted-foreground">
      {children}
    </div>
  )
}

export function DeveloperBrowserOutline({
  items,
  label,
}: {
  items: ReadonlyArray<DeveloperBrowserOutlineItem>
  label: string
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1 border-b py-3">
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring/50"
        >
          {item.label}
          {item.count === undefined ? null : (
            <span className="font-mono text-[10px] tabular-nums">
              {item.count}
            </span>
          )}
        </a>
      ))}
    </nav>
  )
}
