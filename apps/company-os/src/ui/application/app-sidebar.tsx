import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@company/ui/components/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@company/ui/components/sidebar"
import { cn } from "@company/ui/lib/utils"
import { Link, useMatchRoute } from "@tanstack/react-router"
import {
  BracesIcon,
  ChevronsUpDownIcon,
  CodeXmlIcon,
  BoxesIcon,
  PackageIcon,
  PaletteIcon,
  PlugIcon,
  LogOutIcon,
  SettingsIcon,
} from "lucide-react"

import { applicationCapabilities } from "@/capabilities"
import { BrandMark } from "@/customization/brand"
import { applicationConfig } from "@/customization/config"
import {
  operateNavigation,
  salesNavigation,
  salesNavigationChecks,
} from "@/customization/navigation"
import {
  getUserInitials,
  useAuthenticatedUser,
} from "@/ui/application/authenticated-user"
import { useCapabilities } from "@/ui/application/use-capabilities"

const sections = [
  { label: "Operate", to: "/" },
  { label: "Develop", to: "/develop" },
] as const

const developerNavigation = [
  { label: "Overview", to: "/develop", icon: BracesIcon },
  { label: "Model", to: "/develop/model", icon: BoxesIcon },
  {
    label: "API reference",
    to: "/develop/api",
    icon: CodeXmlIcon,
  },
  { label: "SDK", to: "/develop/sdk", icon: PackageIcon },
  { label: "MCP", to: "/develop/mcp", icon: PlugIcon },
  {
    label: "Design system",
    to: "/develop/design-system",
    icon: PaletteIcon,
  },
] as const

type Section = (typeof sections)[number]["label"]

const navigationChecks = [
  ...salesNavigationChecks,
  applicationCapabilities.develop,
]

export function AppSidebar() {
  const user = useAuthenticatedUser()
  const capabilities = useCapabilities(navigationChecks)
  const matchRoute = useMatchRoute()
  const requestedDevelopSection = Boolean(
    matchRoute({
      to: "/develop",
      fuzzy: true,
    })
  )
  const canDevelop = capabilities.can(applicationCapabilities.develop)
  const activeSection: Section =
    requestedDevelopSection && canDevelop ? "Develop" : "Operate"
  const accessibleSalesNavigation = salesNavigation.filter((item) =>
    capabilities.can({ permission: `${item.object.id}.list` })
  )
  const visibleSections = canDevelop
    ? sections
    : sections.filter(({ label }) => label === "Operate")
  const activeSectionIndex = Math.max(
    0,
    visibleSections.findIndex(({ label }) => label === activeSection)
  )

  return (
    <Sidebar variant="sidebar" collapsible="offcanvas">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={applicationConfig.identity.productName}
              render={<Link to="/" />}
            >
              <BrandMark className="size-8" />
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">
                  {applicationConfig.identity.productName}
                </span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  {applicationConfig.identity.descriptor}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <nav
          aria-label={`${applicationConfig.identity.productName} sections`}
          className="relative isolate grid"
          style={{
            gridTemplateColumns: `repeat(${visibleSections.length}, minmax(0, 1fr))`,
          }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-1 left-0 z-0 rounded-sm bg-sidebar-accent transition-transform duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{
              transform: `translateX(${activeSectionIndex * 100}%)`,
              width: `${100 / visibleSections.length}%`,
            }}
          />
          {visibleSections.map((section) => {
            const isActive = section.label === activeSection

            return (
              <Link
                key={section.label}
                to={section.to}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative z-10 flex h-8 items-center justify-center px-2 text-xs text-sidebar-foreground/60 transition-colors duration-200 hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-sidebar-ring motion-reduce:transition-none",
                  isActive && "text-sidebar-accent-foreground"
                )}
              >
                {section.label}
              </Link>
            )
          })}
        </nav>
      </SidebarHeader>

      <SidebarContent>
        {activeSection === "Operate" ? (
          <>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {operateNavigation.map((item) => (
                    <SidebarMenuItem key={item.label}>
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

            {accessibleSalesNavigation.length === 0 ? null : (
              <SidebarGroup>
                <SidebarGroupLabel>Sales</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {accessibleSalesNavigation.map((item) => (
                      <SidebarMenuItem key={item.object.id}>
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
            )}
          </>
        ) : (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {developerNavigation.map((item) => (
                  <SidebarMenuItem key={item.label}>
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
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    tooltip="Account menu"
                    className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
                  />
                }
              >
                <span className="flex size-8 shrink-0 items-center justify-center bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                  {getUserInitials(user.name)}
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-xs font-medium">
                    {user.name}
                  </span>
                  <span className="truncate text-xs text-sidebar-foreground/60">
                    {user.email}
                  </span>
                </span>
                <ChevronsUpDownIcon className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                sideOffset={4}
                className="w-(--anchor-width)"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <span className="block font-medium text-foreground">
                      {user.name}
                    </span>
                    <span className="mt-0.5 block">{user.email}</span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link to="/settings" />}>
                  <SettingsIcon />
                  Account settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  render={<a href="/sign-out" aria-label="Sign out" />}
                >
                  <LogOutIcon />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
