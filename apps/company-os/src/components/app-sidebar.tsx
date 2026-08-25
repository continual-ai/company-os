import { Model } from "@company/model"
import { modelMetadata } from "@company/model/metadata"
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
  ActivityIcon,
  BookOpenIcon,
  BracesIcon,
  Building2Icon,
  BoxesIcon,
  ChevronsUpDownIcon,
  CodeXmlIcon,
  ContactRoundIcon,
  HandshakeIcon,
  HouseIcon,
  LogOutIcon,
  PackageIcon,
  PaletteIcon,
  PlugIcon,
  SettingsIcon,
  UserRoundSearchIcon,
} from "lucide-react"

import { appMetadata } from "@/app-metadata"
import {
  getUserInitials,
  useAuthenticatedUser,
} from "@/components/authenticated-user"
import { useSignOut } from "@/sign-out"

const sections = [
  { label: "Operate", to: "/" },
  { label: "Learn", to: "/learn" },
  { label: "Develop", to: "/develop" },
] as const

const operateNavigation = [{ label: "Home", to: "/", icon: HouseIcon }] as const

const objectIcons = {
  building: Building2Icon,
  handshake: HandshakeIcon,
  interaction: ActivityIcon,
  lead: UserRoundSearchIcon,
  person: ContactRoundIcon,
} as const

const objectPaths = {
  company: "/companies",
  contact: "/contacts",
  deal: "/deals",
  interaction: "/interactions",
  lead: "/leads",
  lineItem: "/line-items",
} as const

function objectIcon(name: string | undefined) {
  return (
    Object.entries(objectIcons).find(([iconName]) => iconName === name)?.[1] ??
    BoxesIcon
  )
}

function objectPath(id: string) {
  return Object.entries(objectPaths).find(
    ([objectType]) => objectType === id
  )?.[1]
}

const operateObjects = Object.values(Model.objects).flatMap((object) => {
  const to = objectPath(object.id)
  return to === undefined
    ? []
    : [
        {
          icon: objectIcon(
            "icon" in object.display ? object.display.icon : undefined
          ),
          id: object.id,
          label: object.pluralName,
          to,
        },
      ]
})

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
  const { error: signOutError, pending: signOutPending, signOut } = useSignOut()
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
              tooltip={`${modelMetadata.name} ${appMetadata.name}`}
              render={<Link to="/" />}
            >
              <span className="flex size-8 shrink-0 items-center justify-center bg-primary text-sm font-semibold text-primary-foreground">
                {modelMetadata.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">
                  {modelMetadata.name}
                </span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  {appMetadata.name}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <nav
          aria-label={`${appMetadata.name} sections`}
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
                  variant="destructive"
                  disabled={signOutPending}
                  onClick={() => void signOut()}
                >
                  <LogOutIcon />
                  {signOutPending
                    ? "Logging out…"
                    : signOutError
                      ? "Log out failed — retry"
                      : "Log out"}
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
