import { Link, useMatchRoute } from "@tanstack/react-router"
import {
  BlocksIcon,
  PaletteIcon,
  SettingsIcon,
  UserRoundIcon,
} from "lucide-react"

import {
  SecondarySidebar,
  SecondarySidebarItem,
  SecondarySidebarSection,
} from "#/app/ui/application/secondary-sidebar.tsx"

const personalItems = [
  { label: "General", to: "/settings", icon: SettingsIcon },
  { label: "Profile", to: "/settings/profile", icon: UserRoundIcon },
  { label: "Appearance", to: "/settings/appearance", icon: PaletteIcon },
] as const

export function SettingsSidebar() {
  const matchRoute = useMatchRoute()

  return (
    <SecondarySidebar>
      <SecondarySidebarSection label="Personal">
        {personalItems.map((item) => (
          <SecondarySidebarItem
            key={item.to}
            icon={item.icon}
            isActive={Boolean(matchRoute({ to: item.to }))}
            label={item.label}
            link={<Link to={item.to} />}
          />
        ))}
      </SecondarySidebarSection>
      <SecondarySidebarSection label="Platform">
        <SecondarySidebarItem
          icon={BlocksIcon}
          isActive={Boolean(
            matchRoute({ to: "/settings/modules", fuzzy: true })
          )}
          label="Modules"
          link={<Link to="/settings/modules" />}
        />
      </SecondarySidebarSection>
    </SecondarySidebar>
  )
}
