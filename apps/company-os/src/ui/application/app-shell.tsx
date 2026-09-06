import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@company/ui/components/sidebar"
import { TooltipProvider } from "@company/ui/components/tooltip"
import { useLocation, useMatchRoute } from "@tanstack/react-router"
import { useEffect } from "react"

import type { AuthenticatedUser } from "@/authentication"
import { AppSidebar } from "@/ui/application/app-sidebar"
import { AuthenticatedUserProvider } from "@/ui/application/authenticated-user"
import { CommandPalette } from "@/ui/application/command-palette"
import { PageChromeProvider } from "@/ui/application/page-chrome"
import { SiteHeader } from "@/ui/application/site-header"
import { DeveloperSidebar } from "@/ui/developer/developer-sidebar"
import { ObjectCreateProvider } from "@/ui/model/object-create-provider"
import { SettingsSidebar } from "@/ui/settings/settings-sidebar"

const sidebarStyle: React.CSSProperties & Record<"--header-height", string> = {
  "--header-height": "3rem",
}

function SidebarNavigation() {
  const href = useLocation({ select: (location) => location.href })
  const { setOpenMobile } = useSidebar()
  useEffect(() => {
    setOpenMobile(false)
  }, [href, setOpenMobile])
  return null
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
  const isDeveloper = Boolean(matchRoute({ to: "/developer", fuzzy: true }))
  const utilityTitle = isSettings
    ? "Settings"
    : isDeveloper
      ? "Developer Center"
      : undefined
  const secondaryShell = utilityTitle !== undefined

  return (
    <AuthenticatedUserProvider user={user}>
      <TooltipProvider>
        <ObjectCreateProvider>
          <CommandPalette>
            <PageChromeProvider>
              <SidebarProvider
                key={secondaryShell ? utilityTitle : "app"}
                className="h-svh min-h-0 overflow-hidden"
                defaultWidth={secondaryShell ? 240 : 256}
                minWidth={224}
                maxWidth={384}
                resizable={!secondaryShell}
                revealOnHover={!secondaryShell}
                style={sidebarStyle}
              >
                <SidebarNavigation />
                {isSettings ? (
                  <SettingsSidebar />
                ) : isDeveloper ? (
                  <DeveloperSidebar />
                ) : (
                  <AppSidebar />
                )}
                <SidebarInset className="h-svh min-h-0 min-w-0 overflow-hidden">
                  {secondaryShell ? (
                    <header className="flex h-(--header-height) shrink-0 items-center gap-3 border-b bg-background px-4 md:hidden">
                      <SidebarTrigger className="-ml-1" />
                      <span className="text-sm font-medium">
                        {utilityTitle}
                      </span>
                    </header>
                  ) : (
                    <SiteHeader />
                  )}
                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                    {children}
                  </div>
                </SidebarInset>
              </SidebarProvider>
            </PageChromeProvider>
          </CommandPalette>
        </ObjectCreateProvider>
      </TooltipProvider>
    </AuthenticatedUserProvider>
  )
}
