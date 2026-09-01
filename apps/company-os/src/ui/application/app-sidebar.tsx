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
import { Link, useMatchRoute } from "@tanstack/react-router"
import { BracesIcon, ChevronsUpDownIcon, SettingsIcon } from "lucide-react"

import { applicationCapabilities, capabilityPermission } from "@/capabilities"
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

const navigationChecks = [
  ...salesNavigationChecks,
  applicationCapabilities.develop,
]

export function AppSidebar() {
  const user = useAuthenticatedUser()
  const capabilities = useCapabilities(navigationChecks)
  const matchRoute = useMatchRoute()
  const canDevelop = capabilities.can(applicationCapabilities.develop)
  const accessibleSalesNavigation = salesNavigation.filter((item) =>
    capabilities.can({
      permission: capabilityPermission(`${item.object.id}.list`),
    })
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
