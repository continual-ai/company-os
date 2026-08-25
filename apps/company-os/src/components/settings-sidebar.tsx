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
  KeyRoundIcon,
  MailPlusIcon,
  MonitorSmartphoneIcon,
  PaletteIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UsersRoundIcon,
  UserRoundIcon,
} from "lucide-react"

const settingsSections = [
  {
    label: "Personal",
    items: [
      { label: "General", to: "/settings", icon: SettingsIcon },
      { label: "Profile", to: "/settings/profile", icon: UserRoundIcon },
      { label: "Appearance", to: "/settings/appearance", icon: PaletteIcon },
      {
        label: "Sessions",
        to: "/settings/sessions",
        icon: MonitorSmartphoneIcon,
      },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Users", to: "/settings/users", icon: UserRoundIcon },
      { label: "Invitations", to: "/settings/invitations", icon: MailPlusIcon },
      { label: "Roles", to: "/settings/roles", icon: ShieldCheckIcon },
      {
        label: "Role assignments",
        to: "/settings/role-assignments",
        icon: ShieldCheckIcon,
      },
      { label: "Groups", to: "/settings/groups", icon: UsersRoundIcon },
      {
        label: "Group memberships",
        to: "/settings/group-memberships",
        icon: UsersRoundIcon,
      },
      {
        label: "Service accounts",
        to: "/settings/service-accounts",
        icon: BotIcon,
      },
      { label: "API keys", to: "/settings/api-keys", icon: KeyRoundIcon },
    ],
  },
] as const

export function SettingsSidebar() {
  const matchRoute = useMatchRoute()

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
        {settingsSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
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
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
