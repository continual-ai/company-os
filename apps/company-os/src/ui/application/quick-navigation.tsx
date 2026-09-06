import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@company/ui/components/command"
import { SidebarMenuButton } from "@company/ui/components/sidebar"
import { useNavigate } from "@tanstack/react-router"
import { SearchIcon } from "lucide-react"
import { useEffect, useState } from "react"

import {
  modelNavigation,
  modelNavigationChecks,
} from "@/ui/model/model-navigation"

import { useCapabilities } from "./use-capabilities"

export function QuickNavigation() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const capabilities = useCapabilities(modelNavigationChecks)
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [])
  return (
    <>
      <SidebarMenuButton onClick={() => setOpen(true)}>
        <SearchIcon />
        <span>Jump to…</span>
        <kbd className="ml-auto text-xs text-muted-foreground">⌘ K</kbd>
      </SidebarMenuButton>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Jump to a collection"
        description="Find a workspace collection and navigate with the keyboard."
      >
        <Command>
          <CommandInput placeholder="Find a collection…" />
          <CommandList>
            <CommandEmpty>No matching collections</CommandEmpty>
            {modelNavigation.map((module) => {
              const items = module.items.filter((item) =>
                capabilities.can(item.check)
              )
              if (items.length === 0) return null
              return (
                <CommandGroup key={module.id} heading={module.name}>
                  {items.map((item) => (
                    <CommandItem
                      key={item.object.id}
                      value={`${module.name} ${item.label}`}
                      onSelect={() => {
                        setOpen(false)
                        void navigate({ to: item.to })
                      }}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            })}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
