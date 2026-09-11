import { Button } from "@company/ui/button"
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@company/ui/command"
import { useKeyboardShortcuts } from "@company/ui/keyboard-shortcuts"
import { SidebarMenuButton } from "@company/ui/sidebar"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { CodeIcon, HomeIcon, PlusIcon, SearchIcon } from "lucide-react"
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { data } from "#/app/app-client.ts"
import { presentation } from "#/app/app-presentation.ts"
import {
  reportPreviews,
  toolPreviews,
  workspaceSections,
} from "#/app/customization/workspace.ts"
import { RecentRecords } from "#/app/ui/application/recent-records-group.tsx"
import type { RecordSummary } from "#/runtime/contract/record-search.ts"
import { useModelNavigation } from "#/runtime/ui/model/module-navigation.tsx"
import { useObjectCreate } from "#/runtime/ui/model/object-create-context.ts"
import { ObjectRecordIdentity } from "#/runtime/ui/model/object-record-identity.tsx"
import { objectHref } from "#/runtime/ui/model/object-routing.ts"
import type { ObjectTableRecord } from "#/runtime/ui/model/object-table/object-table-config.ts"

/** Collections and root-level create commands, from the active model. */
function usePaletteCommands() {
  const navigation = useModelNavigation()
  return useMemo(() => {
    const destinations = navigation.modules.flatMap((module) =>
      module.items.map((item) => ({ ...item, module: module.name }))
    )
    const createCommands = destinations.filter(
      ({ object }) => "create" in object.actions
    )

    return {
      destinations,
      createCommands,
    }
  }, [navigation])
}
const utilityCommands = [
  { label: "Home", to: "/", icon: HomeIcon },
  ...workspaceSections,
  { label: "Developer Center", to: "/developer", icon: CodeIcon },
]

function SearchRecordIdentity({ hit }: { readonly hit: RecordSummary }) {
  const object = presentation.model.objects[hit.objectType]!
  const record: ObjectTableRecord = {
    id: hit.id,
    [object.display.title]: hit.title,
  }
  if (object.display.subtitle !== undefined)
    record[object.display.subtitle] = hit.subtitle
  if (object.display.image !== undefined)
    record[object.display.image] = hit.image
  if (object.display.status !== undefined)
    record[object.display.status] = hit.status
  return (
    <ObjectRecordIdentity
      object={object}
      record={record}
      className="max-w-full"
    />
  )
}

function PaletteContent({ close }: { readonly close: () => void }) {
  const [input, setInput] = useState("")
  const [query, setQuery] = useState("")
  const navigate = useNavigate()
  const create = useObjectCreate()
  const { destinations, createCommands } = usePaletteCommands()
  const trimmed = input.trim()
  useEffect(() => {
    const timer = setTimeout(() => setQuery(trimmed), 150)
    return () => clearTimeout(timer)
  }, [trimmed])
  const result = useQuery({
    ...data.records.search({ query }),
    enabled: query.length > 0,
  })
  const current = query === trimmed
  const hits = current && trimmed.length > 0 ? (result.data?.hits ?? []) : []
  const searching = trimmed.length > 0 && (!current || result.isFetching)
  const failed = current && query.length > 0 && result.isError
  const matches = (text: string) =>
    trimmed
      .toLowerCase()
      .split(/\s+/)
      .every((term) => text.toLowerCase().includes(term))
  const collections = destinations.filter((item) =>
    matches(`${item.label} ${item.module}`)
  )
  const commands = createCommands.filter((item) =>
    matches(`Create new ${item.object.name}`)
  )
  const utilities = utilityCommands.filter((item) => matches(item.label))
  const tools = toolPreviews.filter((item) =>
    matches(`${item.label} ${item.category}`)
  )
  const reports = reportPreviews.filter((item) => matches(item.label))
  const empty =
    hits.length +
      collections.length +
      commands.length +
      utilities.length +
      tools.length +
      reports.length ===
    0
  const go = (to: string) => {
    close()
    void navigate({ to })
  }

  return (
    <Command shouldFilter={false}>
      <CommandInput
        value={input}
        onValueChange={setInput}
        placeholder="Search records, tools, and commands…"
        aria-label="Search records, tools, and commands"
        maxLength={200}
        className="text-sm"
      />
      <CommandList className="max-h-[min(28rem,60dvh)]" aria-busy={searching}>
        {trimmed.length === 0 && <RecentRecords onOpen={go} />}
        {hits.length > 0 && (
          <CommandGroup heading="Records">
            {hits.map((hit) => (
              <CommandItem
                key={hit.id}
                value={hit.id}
                onSelect={() =>
                  go(
                    objectHref(
                      presentation,
                      presentation.model.objects[hit.objectType]!,
                      hit.id
                    )
                  )
                }
                className="gap-3 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <SearchRecordIdentity hit={hit} />
                  {hit.subtitle && (
                    <p className="truncate pl-6.5 text-xs text-muted-foreground">
                      {hit.subtitle}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {presentation.model.objects[hit.objectType]!.name}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {searching && (
          <output className="block px-3 py-3 text-xs text-muted-foreground">
            Searching records…
          </output>
        )}
        {failed && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
          >
            <span>Record search failed.</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void result.refetch()}
            >
              Retry
            </Button>
          </div>
        )}
        {!searching && !failed && empty && (
          <output className="block px-3 py-8 text-center text-sm text-muted-foreground">
            No results. Try another name or keyword.
          </output>
        )}
        {current && result.data?.hasMore && (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            More records match. Keep typing to narrow your search.
          </p>
        )}
        {tools.length > 0 && (
          <CommandGroup heading="Tools">
            {tools.map((tool) => (
              <CommandItem
                key={tool.id}
                value={`tool:${tool.id}`}
                onSelect={() => go(`/tools/${tool.id}`)}
                className="px-3"
              >
                <tool.icon />
                <span className="flex-1">{tool.label}</span>
                <span className="text-muted-foreground">Preview</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {reports.length > 0 && (
          <CommandGroup heading="Reports">
            {reports.map((report) => (
              <CommandItem
                key={report.id}
                value={`report:${report.id}`}
                onSelect={() => go(`/reports/${report.id}`)}
                className="px-3"
              >
                <report.icon />
                <span className="flex-1">{report.label}</span>
                <span className="text-muted-foreground">Preview</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {collections.length > 0 && (
          <CommandGroup heading="Collections">
            {collections.map((item) => (
              <CommandItem
                key={item.object.id}
                value={`collection:${item.object.id}`}
                onSelect={() => go(item.to)}
                className="px-3"
              >
                <item.icon />
                <span className="flex-1">{item.label}</span>
                <span className="text-muted-foreground">{item.module}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {(commands.length > 0 || utilities.length > 0) && (
          <CommandGroup heading="Commands">
            {utilities.map((item) => (
              <CommandItem
                key={item.to}
                value={`navigate:${item.to}`}
                onSelect={() => go(item.to)}
                className="px-3"
              >
                <item.icon />
                {item.label}
              </CommandItem>
            ))}
            {commands.map((item) => (
              <CommandItem
                key={item.object.id}
                value={`create:${item.object.id}`}
                onSelect={() => {
                  close()
                  create(item.object, {
                    onCreated: (record) =>
                      void navigate({
                        to: objectHref(presentation, item.object, record.id),
                      }),
                  })
                }}
                className="px-3"
              >
                <PlusIcon />
                Create {item.object.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
      <div className="flex gap-4 border-t px-3 py-2 text-xs text-muted-foreground">
        <span>↑ ↓ Navigate</span>
        <span>↵ Open</span>
        <span className="ml-auto">Esc Close</span>
      </div>
    </Command>
  )
}

const OpenPalette = createContext<(() => void) | undefined>(undefined)

export function CommandPaletteButton() {
  const open = useContext(OpenPalette)
  return (
    <SidebarMenuButton onClick={open}>
      <SearchIcon />
      <span>Search…</span>
      <kbd className="ml-auto text-xs text-muted-foreground">⌘ K</kbd>
    </SidebarMenuButton>
  )
}

export function CommandPalette({ children }: { readonly children: ReactNode }) {
  const [open, setOpen] = useState(false)
  useKeyboardShortcuts([
    {
      id: "command-palette",
      key: "k",
      mod: true,
      label: "⌘ / Ctrl + K",
      description: "Search and commands",
      group: "General",
      allowInEditable: true,
      allowInOverlay: open,
      run: () => setOpen((value) => !value),
    },
  ])
  return (
    <OpenPalette.Provider value={() => setOpen(true)}>
      {children}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search and commands"
        description="Find records, tools, and destinations, or create a record."
        className="top-[12dvh] sm:max-w-xl"
      >
        {open && <PaletteContent close={() => setOpen(false)} />}
      </CommandDialog>
    </OpenPalette.Provider>
  )
}
