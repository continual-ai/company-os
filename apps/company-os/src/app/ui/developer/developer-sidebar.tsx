import { Link, useMatchRoute } from "@tanstack/react-router"
import {
  BoxesIcon,
  BracesIcon,
  CodeXmlIcon,
  PackageIcon,
  PlugIcon,
} from "lucide-react"

import {
  SecondarySidebar,
  SecondarySidebarItem,
  SecondarySidebarSection,
} from "#/app/ui/application/secondary-sidebar.tsx"

const developerNavigation = [
  { label: "Overview", to: "/developer", icon: BracesIcon },
  { label: "Model", to: "/developer/model", icon: BoxesIcon },
  {
    label: "API reference",
    to: "/developer/api",
    icon: CodeXmlIcon,
  },
  { label: "TypeScript", to: "/developer/sdk", icon: PackageIcon },
  { label: "MCP", to: "/developer/mcp", icon: PlugIcon },
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
