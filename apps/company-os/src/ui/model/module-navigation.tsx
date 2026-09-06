import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@company/ui/components/sidebar"
import { Link, useLocation } from "@tanstack/react-router"

import { useCapabilities } from "@/ui/application/use-capabilities"

import { modelNavigation, modelNavigationChecks } from "./model-navigation"

export function ModuleNavigation() {
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
