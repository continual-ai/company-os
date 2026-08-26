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

import { useCapabilities } from "@/ui/application/use-capabilities"

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
    label: "Access",
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
        capability: { permission: "group.list" },
        label: "Groups",
        to: "/settings/groups",
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

const accessChecks = settingsSections[1].items.map(
  ({ capability }) => capability
)

function settingsItemIsActive(
  to: (typeof settingsSections)[number]["items"][number]["to"],
  matchRoute: ReturnType<typeof useMatchRoute>
) {
  if (matchRoute({ to })) return true
  if (to === "/settings/roles") {
    return Boolean(matchRoute({ to: "/settings/role-assignments" }))
  }
  if (to === "/settings/groups") {
    return Boolean(matchRoute({ to: "/settings/group-memberships" }))
  }
  return false
}

export function SettingsSidebar() {
  const matchRoute = useMatchRoute()
  const capabilities = useCapabilities(accessChecks)

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
                        isActive={settingsItemIsActive(item.to, matchRoute)}
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
