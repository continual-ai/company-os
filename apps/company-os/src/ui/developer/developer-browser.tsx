import { Button } from "@company/ui/components/button"
import { Input } from "@company/ui/components/input"
import { cn } from "@company/ui/lib/utils"
import { CheckIcon, CopyIcon, SearchIcon } from "lucide-react"
import { useState, type ReactNode } from "react"

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
    <section className="flex min-h-[calc(100svh-var(--header-height))] flex-col bg-background">
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

      <div className="grid lg:min-h-0 lg:flex-1 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside
          aria-label={sidebarLabel}
          className="max-h-[22rem] min-w-0 overflow-y-auto border-b bg-muted/10 lg:sticky lg:top-0 lg:max-h-[calc(100svh-var(--header-height))] lg:self-start lg:border-r lg:border-b-0"
        >
          {sidebar}
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
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

export function DeveloperBrowserNavGroup({
  children,
  count,
  title,
}: {
  children: ReactNode
  count?: number
  title: string
}) {
  return (
    <section>
      <div className="flex items-center justify-between px-3 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        <h2>{title}</h2>
        {count === undefined ? null : (
          <span className="font-mono tabular-nums">{count}</span>
        )}
      </div>
      <div className="space-y-px px-1.5 pb-2">{children}</div>
    </section>
  )
}

export function DeveloperBrowserNavItem({
  active,
  children,
  code,
  meta,
  onClick,
}: {
  active: boolean
  children: ReactNode
  code?: ReactNode
  meta?: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "group flex w-full min-w-0 items-start gap-2 px-2.5 py-2 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring/50",
        active && "bg-muted text-foreground"
      )}
      onClick={onClick}
    >
      {code === undefined ? null : (
        <span className="mt-0.5 shrink-0">{code}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{children}</span>
        {meta === undefined ? null : (
          <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
            {meta}
          </span>
        )}
      </span>
    </button>
  )
}

export function DeveloperCodeBlock({
  code,
  label,
}: {
  code: string
  label: string
}) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="overflow-hidden border bg-muted/20">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-[11px] font-medium text-muted-foreground">
          {label}
        </span>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={() => {
            void navigator.clipboard.writeText(code).then(
              () => setCopied(true),
              () => setCopied(false)
            )
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-5">
        <code>{code}</code>
      </pre>
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
