import { Link, useLocation } from "@tanstack/react-router"
import { useMemo } from "react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "#/runtime/ui/components/sidebar.tsx"
import {
  createModelNavigation,
  modelNavigationChecks,
} from "#/runtime/ui/model/model-navigation.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"
import { useCapabilities } from "#/runtime/ui/model/use-capabilities.ts"

/** Module destinations and their list checks, computed once per runtime. */
export function useModelNavigation() {
  const runtime = useModelRuntime()
  return useMemo(() => {
    const modules = createModelNavigation(runtime)
    return { modules, checks: modelNavigationChecks(modules) }
  }, [runtime])
}

export function ModuleNavigation() {
  const { modules: modelNavigation, checks } = useModelNavigation()
  const capabilities = useCapabilities(checks)
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
