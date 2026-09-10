import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@company/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@company/ui/sidebar"
import { Link, useMatchRoute } from "@tanstack/react-router"
import { BracesIcon, ChevronsUpDownIcon, SettingsIcon } from "lucide-react"

import { BrandMark } from "#/app/customization/brand.tsx"
import { appConfig } from "#/app/customization/config.ts"
import { operateNavigation } from "#/app/customization/navigation.ts"
import {
  getUserInitials,
  useAuthenticatedUser,
} from "#/app/ui/application/authenticated-user.tsx"
import { CommandPaletteButton } from "#/app/ui/application/command-palette.tsx"
import { ModuleNavigation } from "#/runtime/ui/model/module-navigation.tsx"

export function AppSidebar() {
  const { open, isMobile } = useSidebar()
  const user = useAuthenticatedUser()
  const matchRoute = useMatchRoute()
  return (
    <Sidebar variant="sidebar" collapsible="offcanvas">
      <SidebarHeader className="gap-0 p-0">
        <SidebarMenu className="gap-0">
          <SidebarMenuItem className="flex h-(--header-height) shrink-0 items-center gap-1 border-b px-2">
            <SidebarMenuButton
              className="min-w-0 flex-1"
              tooltip={appConfig.identity.name}
              render={<Link to="/" />}
            >
              <BrandMark className="size-6" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {appConfig.identity.name}
              </span>
            </SidebarMenuButton>
            <SidebarTrigger
              className="mr-1 text-sidebar-foreground/60"
              aria-label={
                isMobile
                  ? "Close sidebar"
                  : open
                    ? "Collapse sidebar"
                    : "Expand sidebar"
              }
            />
          </SidebarMenuItem>
          <SidebarMenuItem className="p-2">
            <CommandPaletteButton />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
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

        <ModuleNavigation />
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
                <DropdownMenuItem render={<Link to="/developer" />}>
                  <BracesIcon />
                  Developer Center
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link to="/settings" />}>
                  <SettingsIcon />
                  Settings
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
