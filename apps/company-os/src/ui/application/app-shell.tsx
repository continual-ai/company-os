import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@company/ui/components/sidebar"
import { TooltipProvider } from "@company/ui/components/tooltip"
import { useMatchRoute } from "@tanstack/react-router"

import type { AuthenticatedUser } from "@/authentication"
import { AppSidebar } from "@/ui/application/app-sidebar"
import { AuthenticatedUserProvider } from "@/ui/application/authenticated-user"
import { SiteHeader } from "@/ui/application/site-header"
import { ObjectCreateProvider } from "@/ui/model/object-create-provider"
import { SettingsSidebar } from "@/ui/settings/settings-sidebar"

const sidebarStyle: React.CSSProperties & Record<"--header-height", string> = {
  "--header-height": "3rem",
}

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode
  user: AuthenticatedUser
}) {
  const matchRoute = useMatchRoute()
  const isSettings = Boolean(matchRoute({ to: "/settings", fuzzy: true }))

  return (
    <AuthenticatedUserProvider user={user}>
      <TooltipProvider>
        <ObjectCreateProvider>
          <SidebarProvider
            key={isSettings ? "settings" : "app"}
            className="h-svh min-h-0 overflow-hidden"
            defaultWidth={isSettings ? 240 : 256}
            minWidth={224}
            maxWidth={384}
            resizable={!isSettings}
            revealOnHover={!isSettings}
            style={sidebarStyle}
          >
            {isSettings ? <SettingsSidebar /> : <AppSidebar />}
            <SidebarInset className="h-svh min-h-0 min-w-0 overflow-hidden">
              {isSettings ? (
                <header className="flex h-(--header-height) shrink-0 items-center gap-3 border-b bg-background px-4 md:hidden">
                  <SidebarTrigger className="-ml-1" />
                  <span className="text-sm font-medium">Settings</span>
                </header>
              ) : (
                <SiteHeader />
              )}
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                {children}
              </div>
            </SidebarInset>
          </SidebarProvider>
        </ObjectCreateProvider>
      </TooltipProvider>
    </AuthenticatedUserProvider>
  )
}
