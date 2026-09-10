import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@company/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  useSidebar,
} from "@company/ui/sidebar"
import { Link, useLocation } from "@tanstack/react-router"
import { ChevronRightIcon, PinIcon, PinOffIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { useAuthenticatedUser } from "#/app/ui/application/authenticated-user.tsx"
import { useWorkspaceDestinations } from "#/app/ui/application/workspace-destinations.ts"

type Destination = ReturnType<typeof useWorkspaceDestinations>["data"][number]

export function WorkspaceNavigation() {
  const { data, tools, reports, groups } = useWorkspaceDestinations()
  const pathname = useLocation({ select: (location) => location.pathname })
  const { isMobile, setOpenMobile } = useSidebar()
  const user = useAuthenticatedUser()
  const storageKey = `company-os:sidebar-pins:${user.id}`
  const [pins, setPins] = useState<string[]>([])
  const activeGroup = groups.find((group) =>
    group.items.some(
      (item) => pathname === item.to || pathname.startsWith(`${item.to}/`)
    )
  )?.id
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    activeGroup ? { [activeGroup]: true } : {}
  )

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem(storageKey) ?? "null"
      )
      if (
        Array.isArray(saved) &&
        saved.every((item): item is string => typeof item === "string")
      ) {
        setPins(saved)
      }
    } catch {
      // Preferences are optional when browser storage is unavailable.
    }
  }, [storageKey])

  useEffect(() => {
    if (activeGroup)
      setExpanded((current) => ({ ...current, [activeGroup]: true }))
  }, [activeGroup])

  const destinations = [...data, ...tools, ...reports]
  const pinned = pins.flatMap((to) => {
    const item = destinations.find((destination) => destination.to === to)
    return item ? [item] : []
  })
  const active = (to: string) =>
    pathname === to || pathname.startsWith(`${to}/`)
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false)
  }
  const togglePin = (to: string) => {
    const next = pins.includes(to)
      ? pins.filter((pin) => pin !== to)
      : [...pins, to]
    setPins(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      // Pinning still works for this session when storage is unavailable.
    }
  }
  const itemLink = (item: Destination, inPinned = false) => (
    <SidebarMenuItem key={item.to} className="group/destination">
      <SidebarMenuButton
        isActive={active(item.to)}
        aria-current={active(item.to) ? "page" : undefined}
        render={<Link to={item.to} onClick={closeMobile} />}
        className="pr-8"
      >
        <item.icon className="text-muted-foreground" />
        <span>{item.label}</span>
      </SidebarMenuButton>
      <SidebarMenuAction
        className="opacity-0 group-hover/destination:opacity-100 group-focus-within/destination:opacity-100 [@media(hover:none)]:opacity-100"
        aria-label={`${pins.includes(item.to) ? "Unpin" : "Pin"} ${item.label}`}
        title={`${pins.includes(item.to) ? "Unpin" : "Pin"} ${item.label}`}
        aria-pressed={pins.includes(item.to)}
        onClick={() => togglePin(item.to)}
      >
        {inPinned ? (
          <PinOffIcon className="size-3!" />
        ) : (
          <PinIcon
            className={
              pins.includes(item.to) ? "size-3! fill-current" : "size-3!"
            }
          />
        )}
      </SidebarMenuAction>
    </SidebarMenuItem>
  )

  return (
    <>
      {pinned.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>Pinned</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {pinned.map((item) => itemLink(item, true))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
      <SidebarGroup>
        <SidebarGroupLabel>Modules</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {groups.map((group) => {
              const isOpen = expanded[group.id] ?? false
              return (
                <Collapsible
                  key={group.id}
                  open={isOpen}
                  onOpenChange={(open) =>
                    setExpanded((current) => ({ ...current, [group.id]: open }))
                  }
                  render={<SidebarMenuItem />}
                >
                  <SidebarMenuButton
                    render={<CollapsibleTrigger />}
                    isActive={activeGroup === group.id && !isOpen}
                    aria-label={group.label}
                    className="pr-2! font-medium"
                  >
                    <group.icon className="text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      {group.label}
                    </span>
                    <ChevronRightIcon
                      className={`ml-auto size-3.5! text-muted-foreground transition-transform motion-reduce:transition-none ${isOpen ? "rotate-90" : ""}`}
                    />
                  </SidebarMenuButton>
                  <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none">
                    <SidebarMenuSub>
                      {group.items.map((item) => itemLink(item))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )
}
