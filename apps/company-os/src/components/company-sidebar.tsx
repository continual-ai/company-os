import { AcmeModel } from "@acme/api"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@acme/ui/components/dropdown-menu"
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
} from "@acme/ui/components/sidebar"
import { cn } from "@acme/ui/lib/utils"
import { Link, useMatchRoute } from "@tanstack/react-router"
import {
  BarChart3Icon,
  BookOpenIcon,
  BracesIcon,
  Building2Icon,
  BoxesIcon,
  ChevronsUpDownIcon,
  CodeXmlIcon,
  ContactRoundIcon,
  HandshakeIcon,
  HouseIcon,
  ListTodoIcon,
  LogOutIcon,
  PackageIcon,
  PaletteIcon,
  PlugIcon,
  SettingsIcon,
  UserRoundSearchIcon,
} from "lucide-react"

import { getProfileInitials, useLocalProfile } from "@/components/local-profile"

const sections = [
  { label: "Operate", to: "/" },
  { label: "Learn", to: "/learn" },
  { label: "Develop", to: "/develop" },
] as const

const operateNavigation = [
  { label: "Home", to: "/", icon: HouseIcon },
  { label: "Tasks", to: "/tasks", icon: ListTodoIcon },
] as const

const objectIcons = {
  company: Building2Icon,
  contact: ContactRoundIcon,
  deal: HandshakeIcon,
  lead: UserRoundSearchIcon,
} as const

const objectPaths = {
  company: "/companies",
  contact: "/contacts",
  deal: "/deals",
  lead: "/leads",
} as const

const operateObjects = Object.values(AcmeModel.objects).map((object) => ({
  icon: objectIcons[object.id],
  id: object.id,
  label: object.pluralName,
  to: objectPaths[object.id],
}))

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

export function CompanySidebar() {
  const { profile } = useLocalProfile()
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

  return (
    <Sidebar variant="sidebar" collapsible="offcanvas">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Acme Company OS"
              render={<Link to="/" />}
            >
              <span className="flex size-8 shrink-0 items-center justify-center bg-primary text-sm font-semibold text-primary-foreground">
                A
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">Acme</span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  Company OS
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <nav
          aria-label="Company OS sections"
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

            <SidebarGroup>
              <SidebarGroupLabel>Objects</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {operateObjects.map((object) => (
                    <SidebarMenuItem key={object.id}>
                      <SidebarMenuButton
                        tooltip={object.label}
                        isActive={Boolean(matchRoute({ to: object.to }))}
                        render={<Link to={object.to} />}
                      >
                        <object.icon />
                        <span>{object.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="Reports"
                      isActive={Boolean(matchRoute({ to: "/reports" }))}
                      render={<Link to="/reports" />}
                    >
                      <BarChart3Icon />
                      <span>Reports</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
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
                  {getProfileInitials(profile.displayName)}
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-xs font-medium">
                    {profile.displayName}
                  </span>
                  <span className="truncate text-xs text-sidebar-foreground/60">
                    Signed in locally
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
                      {profile.displayName}
                    </span>
                    <span className="mt-0.5 block">Signed in locally</span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link to="/settings" />}>
                  <SettingsIcon />
                  Account settings
                </DropdownMenuItem>
                <DropdownMenuItem disabled variant="destructive">
                  <LogOutIcon />
                  Log out
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
