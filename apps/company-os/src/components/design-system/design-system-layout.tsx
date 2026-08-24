import { cn } from "@company/ui/lib/utils"
import { Link, Outlet, useMatchRoute } from "@tanstack/react-router"
import { ChevronDownIcon } from "lucide-react"

import { componentGroups } from "@/components/design-system/component-metadata"

export function DesignSystemLayout() {
  return (
    <div className="mx-auto grid min-h-full w-full max-w-[90rem] lg:h-full lg:grid-cols-[15rem_minmax(0,1fr)] lg:overflow-hidden">
      <aside className="border-b bg-background lg:h-full lg:overflow-y-auto lg:border-r lg:border-b-0">
        <details className="group lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-xs font-medium [&::-webkit-details-marker]:hidden">
            Browse design system
            <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="max-h-[60vh] overflow-y-auto border-t">
            <DesignSystemNavigation />
          </div>
        </details>
        <div className="hidden lg:block">
          <DesignSystemNavigation />
        </div>
      </aside>

      <main className="min-w-0 lg:h-full lg:overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}

function DesignSystemNavigation() {
  const matchRoute = useMatchRoute()

  return (
    <nav
      aria-label="Design system"
      className="grid gap-6 px-5 py-6 lg:px-6 lg:py-8"
    >
      <div>
        <p className="text-xs font-medium text-muted-foreground">Explore</p>
        <div className="mt-2 grid gap-0.5">
          <DesignSystemLink
            active={Boolean(
              matchRoute({ to: "/develop/design-system", fuzzy: false })
            )}
            to="/develop/design-system"
          >
            Overview
          </DesignSystemLink>
          <DesignSystemLink
            active={Boolean(
              matchRoute({
                to: "/develop/design-system/foundations",
                fuzzy: false,
              })
            )}
            to="/develop/design-system/foundations"
          >
            Foundations
          </DesignSystemLink>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground">
          Product patterns
        </p>
        <div className="mt-2 grid gap-0.5">
          <DesignSystemLink
            active={Boolean(
              matchRoute({
                to: "/develop/design-system/patterns/object-table",
                fuzzy: false,
              })
            )}
            to="/develop/design-system/patterns/object-table"
          >
            Object table
          </DesignSystemLink>
        </div>
      </div>

      {componentGroups.map((group) => (
        <div key={group.label}>
          <p className="text-xs font-medium text-muted-foreground">
            {group.label}
          </p>
          <div className="mt-2 grid gap-0.5">
            {group.components.map((component) => {
              const active = Boolean(
                matchRoute({
                  to: "/develop/design-system/components/$componentId",
                  params: { componentId: component.slug },
                  fuzzy: false,
                })
              )

              return (
                <Link
                  key={component.slug}
                  to="/develop/design-system/components/$componentId"
                  params={{ componentId: component.slug }}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "px-2 py-1.5 text-xs transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                    active
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {component.name}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

function DesignSystemLink({
  active,
  children,
  to,
}: {
  active: boolean
  children: React.ReactNode
  to:
    | "/develop/design-system"
    | "/develop/design-system/foundations"
    | "/develop/design-system/patterns/object-table"
}) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "px-2 py-1.5 text-xs transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
        active
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground"
      )}
    >
      {children}
    </Link>
  )
}
