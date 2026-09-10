import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@company/ui/breadcrumb"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@company/ui/command"
import { useAvailableShortcuts } from "@company/ui/keyboard-shortcuts"
import { PageContent, PageHeader } from "@company/ui/page"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@company/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@company/ui/tabs"
import { FileTextIcon, HomeIcon, UsersIcon } from "lucide-react"
import { useState } from "react"

import {
  Example,
  type ComponentSection,
} from "#/app/ui/developer/design-system/example.tsx"

export const navigationSections: ReadonlyArray<ComponentSection> = [
  {
    id: "keyboard-shortcuts",
    title: "Keyboard shortcuts",
    description:
      "Register page shortcuts once and use the same definitions in help. Focused editors and open overlays retain their own keyboard behavior.",
    component: KeyboardShortcutExamples,
    usage:
      'import { KeyboardShortcutsProvider, useKeyboardShortcuts, useAvailableShortcuts } from "@company/ui/keyboard-shortcuts"\n\n// Mount KeyboardShortcutsProvider around the application.\n// Inside a page component:\nuseKeyboardShortcuts([{\n  id: "next-record",\n  key: "ArrowRight",\n  label: "→",\n  description: "Next record",\n  group: "Records",\n  enabled: hasNextRecord,\n  run: openNextRecord,\n}])\n\n// A help view reads the current registrations.\nconst shortcuts = useAvailableShortcuts()',
  },
  {
    id: "breadcrumb",
    title: "Breadcrumb",
    description:
      "Show the route back to a parent collection. Avoid repeating a record name already visible in the page heading.",
    component: BreadcrumbExamples,
    usage:
      'import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbPage } from "@company/ui/breadcrumb"\n\n<Breadcrumb>\n  <BreadcrumbList>\n    <BreadcrumbItem><BreadcrumbPage>Companies</BreadcrumbPage></BreadcrumbItem>\n  </BreadcrumbList>\n</Breadcrumb>',
  },
  {
    id: "command",
    title: "Command",
    description:
      "Filter a list of actions with the keyboard. Include a useful empty state.",
    component: CommandExamples,
    usage:
      'import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@company/ui/command"\n\n<Command>\n  <CommandInput placeholder="Find an action…" />\n  <CommandList>\n    <CommandEmpty>No matching actions.</CommandEmpty>\n    <CommandItem onSelect={() => {}}>Create a note</CommandItem>\n  </CommandList>\n</Command>',
  },
  {
    id: "sidebar",
    title: "Sidebar",
    description:
      "Persistent workspace navigation, grouped by the work people need to do.",
    component: SidebarExamples,
    usage:
      'import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@company/ui/sidebar"\n\n<SidebarProvider>\n  <Sidebar>\n    <SidebarContent>\n      <SidebarMenu>\n        <SidebarMenuItem><SidebarMenuButton isActive>Home</SidebarMenuButton></SidebarMenuItem>\n      </SidebarMenu>\n    </SidebarContent>\n  </Sidebar>\n</SidebarProvider>',
  },
  {
    id: "tabs",
    title: "Tabs",
    description:
      "Switch between related views within one context. Use the header variant inside PageHeader.navigation for aligned page tabs.",
    component: TabsExamples,
    usage:
      'import { PageHeader, PageContent } from "@company/ui/page"\nimport { Tabs, TabsList, TabsTrigger, TabsContent } from "@company/ui/tabs"\n\n<Tabs defaultValue="overview" className="gap-0">\n  <PageHeader navigation={\n    <TabsList variant="header">\n      <TabsTrigger value="overview">Overview</TabsTrigger>\n      <TabsTrigger value="activity">Activity</TabsTrigger>\n    </TabsList>\n  }>\n    <h1>Record title</h1>\n  </PageHeader>\n  <TabsContent value="overview"><PageContent>Record overview</PageContent></TabsContent>\n  <TabsContent value="activity"><PageContent>Recent activity</PageContent></TabsContent>\n</Tabs>',
  },
]

function SidebarExamples() {
  const [active, setActive] = useState("Home")
  return (
    <Example title="Sidebar" source="@company/ui/sidebar">
      <SidebarProvider className="min-h-0" defaultOpen>
        <Sidebar collapsible="none" className="rounded-md border">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarMenu>
                {[
                  { name: "Home", icon: HomeIcon },
                  { name: "Companies", icon: UsersIcon },
                  { name: "Notes", icon: FileTextIcon },
                ].map(({ name, icon: Icon }) => (
                  <SidebarMenuItem key={name}>
                    <SidebarMenuButton
                      isActive={active === name}
                      onClick={() => setActive(name)}
                    >
                      <Icon />
                      <span>{name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    </Example>
  )
}

function BreadcrumbExamples() {
  return (
    <Example title="Hierarchy" source="@company/ui/breadcrumb">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>Workspace</BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>Companies</BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Northstar Studio</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </Example>
  )
}

function TabsExamples() {
  return (
    <>
      <Example title="Page header" source="@company/ui/page">
        <Tabs
          defaultValue="overview"
          className="gap-0 overflow-hidden rounded-lg border"
        >
          <PageHeader
            navigation={
              <TabsList variant="header">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
            }
          >
            <h3 className="font-semibold">Northstar Studio</h3>
          </PageHeader>
          <TabsContent value="overview">
            <PageContent>Record properties and related records.</PageContent>
          </TabsContent>
          <TabsContent value="activity">
            <PageContent>A history of the work completed.</PageContent>
          </TabsContent>
        </Tabs>
      </Example>
      {(["default", "line"] as const).map((variant) => (
        <Example
          key={variant}
          title={variant === "line" ? "Underlined" : "Segmented"}
          source="@company/ui/tabs"
        >
          <Tabs defaultValue="overview" className="mt-5">
            <TabsList variant={variant}>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="unavailable" disabled>
                Unavailable
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="py-3 text-sm">
              The record and its most important context.
            </TabsContent>
            <TabsContent value="activity" className="py-3 text-sm">
              A history of the work completed.
            </TabsContent>
          </Tabs>
        </Example>
      ))}
    </>
  )
}

function CommandExamples() {
  const [command, setCommand] = useState("No command selected")
  return (
    <Example title="Command search" source="@company/ui/command">
      <Command className="max-w-lg rounded-lg border">
        <CommandInput placeholder="Search example commands…" />
        <CommandList>
          <CommandEmpty>No matching commands.</CommandEmpty>
          <CommandGroup heading="Example actions">
            {["Find a company", "Create a note", "Review requests"].map(
              (name) => (
                <CommandItem key={name} onSelect={() => setCommand(name)}>
                  {name}
                </CommandItem>
              )
            )}
          </CommandGroup>
        </CommandList>
      </Command>
      <output className="mt-3 block text-xs text-muted-foreground">
        {command}
      </output>
    </Example>
  )
}

function KeyboardShortcutExamples() {
  const shortcuts = useAvailableShortcuts()
  return (
    <Example
      title="Available on this page"
      source="@company/ui/keyboard-shortcuts"
    >
      <p className="mb-3 text-muted-foreground">
        Press <kbd>?</kbd> outside an input to open shortcut help.
      </p>
      <dl className="max-w-md divide-y">
        {shortcuts.map((shortcut) => (
          <div
            key={shortcut.id}
            className="flex items-center justify-between gap-4 py-2"
          >
            <dt>{shortcut.description}</dt>
            <dd>
              <kbd className="rounded border bg-muted/40 px-2 py-1">
                {shortcut.label ?? shortcut.key}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
    </Example>
  )
}
