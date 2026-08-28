import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@company/ui/components/sidebar"
import { Link } from "@tanstack/react-router"
import { ArrowLeftIcon, type LucideIcon } from "lucide-react"
import type { ReactElement, ReactNode } from "react"

export function SecondarySidebar({ children }: { children: ReactNode }) {
  return (
    <Sidebar variant="sidebar" collapsible="offcanvas">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link to="/" />} tooltip="Back to app">
              <ArrowLeftIcon />
              <span>Back to app</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>{children}</SidebarContent>
    </Sidebar>
  )
}

export function SecondarySidebarSection({
  children,
  label,
}: {
  children: ReactNode
  label?: string
}) {
  return (
    <SidebarGroup>
      {label === undefined ? null : (
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>{children}</SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function SecondarySidebarItem({
  icon: Icon,
  isActive,
  label,
  link,
}: {
  icon: LucideIcon
  isActive: boolean
  label: string
  link: ReactElement
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton tooltip={label} isActive={isActive} render={link}>
        <Icon />
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
