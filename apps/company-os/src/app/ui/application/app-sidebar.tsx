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
import { applicationCapabilities } from "#/runtime/client/capabilities.ts"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/runtime/ui/components/dropdown-menu.tsx"
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
} from "#/runtime/ui/components/sidebar.tsx"
import { ModuleNavigation } from "#/runtime/ui/model/module-navigation.tsx"
import { useCapabilities } from "#/runtime/ui/model/use-capabilities.ts"

const navigationChecks = [applicationCapabilities.develop]

export function AppSidebar() {
  const user = useAuthenticatedUser()
  const capabilities = useCapabilities(navigationChecks)
  const matchRoute = useMatchRoute()
  const canDevelop = capabilities.can(applicationCapabilities.develop)
  return (
    <Sidebar variant="sidebar" collapsible="offcanvas">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={appConfig.identity.name}
              render={<Link to="/" />}
            >
              <BrandMark className="size-8" />
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">
                  {appConfig.identity.name}
                </span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  {appConfig.identity.descriptor}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
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
                {canDevelop ? (
                  <DropdownMenuItem render={<Link to="/developer" />}>
                    <BracesIcon />
                    Developer Center
                  </DropdownMenuItem>
                ) : null}
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
