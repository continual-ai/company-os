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
import { Link, useMatchRoute } from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  BotIcon,
  PaletteIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UsersRoundIcon,
  UserRoundIcon,
} from "lucide-react"

import { useCapabilities } from "./use-capabilities"

const settingsSections = [
  {
    label: "Personal",
    items: [
      { label: "General", to: "/settings", icon: SettingsIcon },
      { label: "Profile", to: "/settings/profile", icon: UserRoundIcon },
      { label: "Appearance", to: "/settings/appearance", icon: PaletteIcon },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        capability: { permission: "user.list" },
        label: "Users",
        to: "/settings/users",
        icon: UserRoundIcon,
      },
      {
        capability: { permission: "role.list" },
        label: "Roles",
        to: "/settings/roles",
        icon: ShieldCheckIcon,
      },
      {
        capability: { permission: "roleAssignment.list" },
        label: "Role assignments",
        to: "/settings/role-assignments",
        icon: ShieldCheckIcon,
      },
      {
        capability: { permission: "group.list" },
        label: "Groups",
        to: "/settings/groups",
        icon: UsersRoundIcon,
      },
      {
        capability: { permission: "groupMembership.list" },
        label: "Group memberships",
        to: "/settings/group-memberships",
        icon: UsersRoundIcon,
      },
      {
        capability: { permission: "serviceAccount.list" },
        label: "Service accounts",
        to: "/settings/service-accounts",
        icon: BotIcon,
      },
    ],
  },
] as const

const administrationChecks = settingsSections[1].items.map(
  ({ capability }) => capability
)

export function SettingsSidebar() {
  const matchRoute = useMatchRoute()
  const capabilities = useCapabilities(administrationChecks)

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

      <SidebarContent>
        {settingsSections.map((section) => {
          const items = section.items.filter(
            (item) =>
              !("capability" in item) || capabilities.can(item.capability)
          )
          return items.length === 0 ? null : (
            <SidebarGroup key={section.label}>
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        tooltip={item.label}
                        isActive={Boolean(matchRoute({ to: item.to }))}
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
      </SidebarContent>
    </Sidebar>
  )
}
