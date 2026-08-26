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
  BookOpenIcon,
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

import {
  getUserInitials,
  useAuthenticatedUser,
} from "@/components/authenticated-user"
import { useCapabilities } from "@/components/use-capabilities"
import { BrandMark } from "@/customization/brand"
import { applicationConfig } from "@/customization/config"
import {
  objectNavigation,
  objectNavigationChecks,
  operateNavigation,
} from "@/customization/navigation"

const sections = [
  { label: "Operate", to: "/" },
  { label: "Learn", to: "/learn" },
  { label: "Develop", to: "/develop" },
] as const

const learnNavigation = [
  { label: "Knowledge", to: "/learn", icon: BookOpenIcon },
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

const sectionIndicatorPosition = {
  Operate: "translate-x-0",
  Learn: "translate-x-full",
  Develop: "translate-x-[200%]",
} as const satisfies Record<Section, string>

export function AppSidebar() {
  const user = useAuthenticatedUser()
  const capabilities = useCapabilities(objectNavigationChecks)
  const matchRoute = useMatchRoute()
  const activeSection: Section = matchRoute({
    to: "/develop",
    fuzzy: true,
  })
    ? "Develop"
    : matchRoute({ to: "/learn" })
      ? "Learn"
      : "Operate"
  const activeNavigation =
    activeSection === "Develop" ? developerNavigation : learnNavigation
  const accessibleObjectNavigation = objectNavigation.filter((item) =>
    capabilities.can({ permission: `${item.object.id}.list` })
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
          className="relative isolate grid grid-cols-3"
        >
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-y-1 left-0 z-0 w-1/3 rounded-sm bg-sidebar-accent transition-transform duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              sectionIndicatorPosition[activeSection]
            )}
          />
          {sections.map((section) => {
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

            {accessibleObjectNavigation.length === 0 ? null : (
              <SidebarGroup>
                <SidebarGroupLabel>Objects</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {accessibleObjectNavigation.map((item) => (
                      <SidebarMenuItem key={item.object.id}>
                        <SidebarMenuButton
                          tooltip={item.object.pluralName}
                          isActive={Boolean(matchRoute({ to: item.to }))}
                          render={<Link to={item.to} />}
                        >
                          <item.icon />
                          <span>{item.object.pluralName}</span>
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
                {activeNavigation.map((item) => (
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
