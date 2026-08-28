import { Link, useMatchRoute } from "@tanstack/react-router"
import {
  BotIcon,
  PaletteIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UsersRoundIcon,
  UserRoundIcon,
} from "lucide-react"

import {
  SecondarySidebar,
  SecondarySidebarItem,
  SecondarySidebarSection,
} from "@/ui/application/secondary-sidebar"
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
    <SecondarySidebar>
      {settingsSections.map((section) => {
        const items = section.items.filter(
          (item) => !("capability" in item) || capabilities.can(item.capability)
        )
        return items.length === 0 ? null : (
          <SecondarySidebarSection key={section.label} label={section.label}>
            {items.map((item) => (
              <SecondarySidebarItem
                key={item.to}
                icon={item.icon}
                isActive={settingsItemIsActive(item.to, matchRoute)}
                label={item.label}
                link={<Link to={item.to} />}
              />
            ))}
          </SecondarySidebarSection>
        )
      })}
    </SecondarySidebar>
  )
}
