import { Link, useLocation } from "@tanstack/react-router"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "#/runtime/ui/components/sidebar.tsx"
import { createModelNavigation } from "#/runtime/ui/model/model-navigation.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"
import { useCapabilities } from "#/runtime/ui/model/use-capabilities.ts"

export function ModuleNavigation() {
  const modelNavigation = createModelNavigation(useModelRuntime())
  const modelNavigationChecks = modelNavigation.flatMap((module) =>
    module.items.map((item) => item.check)
  )
  const capabilities = useCapabilities(modelNavigationChecks)
  const pathname = useLocation({ select: (location) => location.pathname })
  return (
    <>
      {modelNavigation.map((module) => {
        const items = module.items.filter((item) =>
          capabilities.can(item.check)
        )
        if (items.length === 0) return null
        return (
          <SidebarGroup key={module.id}>
            <SidebarGroupLabel>{module.name}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.object.id}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={
                        pathname === item.to ||
                        pathname.startsWith(`${item.to}/`)
                      }
                      render={<Link to={item.to} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )
      })}
    </>
  )
}
