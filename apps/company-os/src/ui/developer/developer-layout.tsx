import { Button } from "@company/runtime/ui/button"
import { cn } from "@company/runtime/ui/lib/utils"
import { useLocation } from "@tanstack/react-router"
import { ListIcon } from "lucide-react"
import { useId, useState, type ReactElement, type ReactNode } from "react"

/** Local navigation stays beside an independently scrolling page on desktop. */
export function DeveloperLayout({
  children,
  header,
  sidebar,
  sidebarLabel,
}: {
  children: ReactNode
  header?: ReactNode
  sidebar: ReactNode
  sidebarLabel: string
}) {
  const catalogId = useId()
  const location = useLocation({ select: (current) => current.href })
  const [openLocation, setOpenLocation] = useState<string>()
  const catalogOpen = openLocation === location

  return (
    <section className="flex flex-1 flex-col bg-background lg:min-h-0 lg:overflow-hidden">
      <div className="shrink-0 border-b px-4 py-2 lg:hidden">
        <Button
          variant="outline"
          size="sm"
          aria-controls={catalogId}
          aria-expanded={catalogOpen}
          onClick={() => setOpenLocation(catalogOpen ? undefined : location)}
        >
          <ListIcon />
          {catalogOpen ? "Hide" : "Browse"} {sidebarLabel.toLowerCase()}
        </Button>
      </div>
      <div className="grid lg:min-h-0 lg:flex-1 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside
          id={catalogId}
          aria-label={sidebarLabel}
          className={cn(
            "max-h-[22rem] min-w-0 overflow-y-auto overscroll-contain border-b bg-muted/10 lg:block lg:max-h-none lg:min-h-0 lg:border-r lg:border-b-0",
            !catalogOpen && "hidden"
          )}
        >
          {sidebar}
        </aside>
        <div className="flex min-w-0 flex-col lg:min-h-0">
          {header}
          <div className="min-w-0 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
            {children}
          </div>
        </div>
      </div>
    </section>
  )
}

export function DeveloperNavigationGroup({
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

export function DeveloperNavigationItem({
  active,
  children,
  code,
  meta,
  onClick,
  render,
}: {
  active: boolean
  children: ReactNode
  code?: ReactNode
  meta?: ReactNode
  onClick?: () => void
  render?: ReactElement
}) {
  return (
    <Button
      variant="ghost"
      nativeButton={render === undefined}
      render={render}
      role={render === undefined ? undefined : "link"}
      data-slot="developer-navigation-item"
      aria-pressed={render === undefined ? active : undefined}
      aria-current={render !== undefined && active ? "page" : undefined}
      className={cn(
        "group flex h-auto w-full min-w-0 items-start justify-start gap-2 px-2.5 py-2 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring/50",
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
    </Button>
  )
}
