import { KeyboardShortcutsProvider } from "@company/ui/keyboard-shortcuts"
import { LocalPreferencesProvider } from "@company/ui/local-preferences"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@company/ui/sidebar"
import { TooltipProvider } from "@company/ui/tooltip"
import { useLocation, useMatchRoute } from "@tanstack/react-router"
import { useEffect } from "react"

import { AppSidebar } from "#/app/ui/application/app-sidebar.tsx"
import { AuthenticatedUserProvider } from "#/app/ui/application/authenticated-user.tsx"
import { CommandPalette } from "#/app/ui/application/command-palette.tsx"
import { KeyboardShortcutHelp } from "#/app/ui/application/keyboard-shortcut-help.tsx"
import { SiteHeader } from "#/app/ui/application/site-header.tsx"
import { DeveloperSidebar } from "#/app/ui/developer/developer-sidebar.tsx"
import { SettingsSidebar } from "#/app/ui/settings/settings-sidebar.tsx"
import type { AuthenticatedUser } from "#/runtime/contract/authenticated-user.ts"
import { ObjectCreateProvider } from "#/runtime/ui/model/object-create-provider.tsx"
import { PageChromeProvider } from "#/runtime/ui/model/page-chrome.tsx"
import { RecentRecordsProvider } from "#/runtime/ui/model/recent-records.tsx"
import { CollectionNavigationProvider } from "#/runtime/ui/model/record-navigation.tsx"

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
    <LocalPreferencesProvider
      key={user.id}
      scope={`company-os:preferences:${user.id}`}
    >
      <AuthenticatedUserProvider user={user}>
        <TooltipProvider>
          <KeyboardShortcutsProvider>
            <KeyboardShortcutHelp />
            <ObjectCreateProvider>
              <CommandPalette>
                <RecentRecordsProvider>
                  <CollectionNavigationProvider>
                    <PageChromeProvider>
                      <SidebarProvider
                        key={secondaryShell ? utilityTitle : "app"}
                        className="h-svh min-h-0 overflow-hidden"
                        defaultWidth={secondaryShell ? 240 : 256}
                        minWidth={224}
                        maxWidth={384}
                        resizable={!secondaryShell}
                        widthPreference={
                          secondaryShell ? undefined : "sidebar-width"
                        }
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
                          {isDeveloper ? (
                            <header className="flex h-(--header-height) shrink-0 items-center gap-3 border-b bg-background px-page-gutter md:hidden">
                              <SidebarTrigger className="-ml-1" />
                              <span className="text-sm font-medium">
                                {utilityTitle}
                              </span>
                            </header>
                          ) : (
                            <SiteHeader />
                          )}
                          <div
                            data-page-content
                            className="flex min-h-0 flex-1 flex-col overflow-y-auto"
                          >
                            {children}
                          </div>
                        </SidebarInset>
                      </SidebarProvider>
                    </PageChromeProvider>
                  </CollectionNavigationProvider>
                </RecentRecordsProvider>
              </CommandPalette>
            </ObjectCreateProvider>
          </KeyboardShortcutsProvider>
        </TooltipProvider>
      </AuthenticatedUserProvider>
    </LocalPreferencesProvider>
  )
}
