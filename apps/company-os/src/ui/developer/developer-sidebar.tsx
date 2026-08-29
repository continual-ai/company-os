import { Link, useMatchRoute } from "@tanstack/react-router"
import {
  BoxesIcon,
  BracesIcon,
  CodeXmlIcon,
  PackageIcon,
  PaletteIcon,
  PlugIcon,
} from "lucide-react"

import {
  SecondarySidebar,
  SecondarySidebarItem,
  SecondarySidebarSection,
} from "@/ui/application/secondary-sidebar"

const developerNavigation = [
  { label: "Overview", to: "/developer", icon: BracesIcon },
  { label: "Model", to: "/developer/model", icon: BoxesIcon },
  {
    label: "API reference",
    to: "/developer/api",
    icon: CodeXmlIcon,
  },
  { label: "SDK", to: "/developer/sdk", icon: PackageIcon },
  { label: "MCP", to: "/developer/mcp", icon: PlugIcon },
  {
    label: "Design system",
    to: "/developer/design-system",
    icon: PaletteIcon,
  },
] as const

export function DeveloperSidebar() {
  const matchRoute = useMatchRoute()

  return (
    <SecondarySidebar>
      <SecondarySidebarSection>
        {developerNavigation.map((item) => (
          <SecondarySidebarItem
            key={item.to}
            icon={item.icon}
            isActive={Boolean(matchRoute({ to: item.to }))}
            label={item.label}
            link={<Link to={item.to} />}
          />
        ))}
      </SecondarySidebarSection>
    </SecondarySidebar>
  )
}
