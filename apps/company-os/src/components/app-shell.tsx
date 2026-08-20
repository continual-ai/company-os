import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@acme/ui/components/sidebar"
import { TooltipProvider } from "@acme/ui/components/tooltip"
import { useMatchRoute } from "@tanstack/react-router"

import { CompanySidebar } from "@/components/company-sidebar"
import { LocalProfileProvider } from "@/components/local-profile"
import { SettingsSidebar } from "@/components/settings-sidebar"
import { SiteHeader } from "@/components/site-header"

const sidebarStyle: React.CSSProperties & Record<"--header-height", string> = {
  "--header-height": "3rem",
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const matchRoute = useMatchRoute()
  const isSettings = Boolean(matchRoute({ to: "/settings", fuzzy: true }))

  return (
    <LocalProfileProvider>
      <TooltipProvider>
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
          {isSettings ? <SettingsSidebar /> : <CompanySidebar />}
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
      </TooltipProvider>
    </LocalProfileProvider>
  )
}
