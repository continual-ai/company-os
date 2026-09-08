import { Link, Outlet, useMatchRoute } from "@tanstack/react-router"

import { componentGroups } from "#/ui/developer/design-system/component-metadata.ts"
import {
  DeveloperLayout,
  DeveloperNavigationGroup,
  DeveloperNavigationItem,
} from "#/ui/developer/developer-layout.tsx"

export function DesignSystemLayout() {
  return (
    <DeveloperLayout
      sidebar={<DesignSystemNavigation />}
      sidebarLabel="Design system"
    >
      <Outlet />
    </DeveloperLayout>
  )
}

function DesignSystemNavigation() {
  const matchRoute = useMatchRoute()

  return (
    <nav aria-label="Design system" className="py-2">
      <DeveloperNavigationGroup title="Explore">
        <DesignSystemLink
          active={Boolean(
            matchRoute({ to: "/developer/design-system", fuzzy: false })
          )}
          to="/developer/design-system"
        >
          Overview
        </DesignSystemLink>
        <DesignSystemLink
          active={Boolean(
            matchRoute({
              to: "/developer/design-system/foundations",
              fuzzy: false,
            })
          )}
          to="/developer/design-system/foundations"
        >
          Foundations
        </DesignSystemLink>
      </DeveloperNavigationGroup>

      <DeveloperNavigationGroup title="Product patterns">
        <DesignSystemLink
          active={Boolean(
            matchRoute({
              to: "/developer/design-system/patterns/object-table",
              fuzzy: false,
            })
          )}
          to="/developer/design-system/patterns/object-table"
        >
          Object table
        </DesignSystemLink>
      </DeveloperNavigationGroup>

      {componentGroups.map((group) => (
        <DeveloperNavigationGroup key={group.label} title={group.label}>
          {group.components.map((component) => {
            const active = Boolean(
              matchRoute({
                to: "/developer/design-system/components/$componentId",
                params: { componentId: component.slug },
                fuzzy: false,
              })
            )

            return (
              <DeveloperNavigationItem
                key={component.slug}
                active={active}
                render={
                  <Link
                    to="/developer/design-system/components/$componentId"
                    params={{ componentId: component.slug }}
                  />
                }
              >
                {component.name}
              </DeveloperNavigationItem>
            )
          })}
        </DeveloperNavigationGroup>
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
    | "/developer/design-system"
    | "/developer/design-system/foundations"
    | "/developer/design-system/patterns/object-table"
}) {
  return (
    <DeveloperNavigationItem active={active} render={<Link to={to} />}>
      {children}
    </DeveloperNavigationItem>
  )
}
