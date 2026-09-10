import { Badge } from "@company/ui/badge"
import { Input } from "@company/ui/input"
import { PageContent } from "@company/ui/page"
import { Link } from "@tanstack/react-router"
import { ArrowRightIcon, SearchIcon } from "lucide-react"
import { useState, type ReactNode } from "react"

import { reportPreviews, toolPreviews } from "#/app/customization/workspace.ts"
import { useWorkspaceDestinations } from "#/app/ui/application/workspace-destinations.ts"

function Directory({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <PageContent className="w-full">
      <header>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Workspace
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </header>
      {children}
    </PageContent>
  )
}

export function ToolsDirectory() {
  const [query, setQuery] = useState("")
  const tools = toolPreviews.filter((tool) =>
    `${tool.label} ${tool.description} ${tool.category}`
      .toLowerCase()
      .includes(query.toLowerCase().trim())
  )
  return (
    <Directory
      title="Tools"
      description="A place for the tools your team uses to get work done."
    >
      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
        <Input
          aria-label="Find a tool"
          placeholder="Find a tool…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-9"
        />
      </div>
      <section aria-labelledby="example-tools">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 id="example-tools" className="text-sm font-medium">
            Explore the possibilities
          </h2>
          <Badge variant="outline">Navigation preview</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => (
            <Link
              key={tool.id}
              to="/tools/$toolId"
              params={{ toolId: tool.id }}
              className="group flex flex-col rounded-xl border bg-card p-5 transition-colors hover:border-foreground/25 hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-lg border bg-background">
                  <tool.icon className="size-5 text-foreground/75" />
                </span>
                <span className="text-xs text-muted-foreground">
                  {tool.category}
                </span>
              </div>
              <h3 className="font-medium">{tool.label}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                {tool.description}
              </p>
              <span className="mt-6 flex items-center gap-2 text-xs font-medium">
                Explore preview{" "}
                <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
        {tools.length === 0 && (
          <p className="py-10 text-sm text-muted-foreground">
            No tools match “{query}”.
          </p>
        )}
        <p className="mt-5 text-xs leading-5 text-muted-foreground">
          These are example destinations. Tool execution isn't connected in this
          prototype.
        </p>
      </section>
    </Directory>
  )
}

export function DataDirectory() {
  const { data } = useWorkspaceDestinations()
  const [query, setQuery] = useState("")
  const filtered = data.filter((item) =>
    `${item.label} ${item.group}`
      .toLowerCase()
      .includes(query.toLowerCase().trim())
  )
  const groups = [...new Set(filtered.map((item) => item.group))]
  return (
    <Directory
      title="Data"
      description="The shared records behind your team's work. Browse a collection to get started."
    >
      <Input
        aria-label="Find a collection"
        placeholder="Find a collection…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="max-w-sm"
      />
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {query
            ? "No collections match your search."
            : "Collections will appear here when they are added to your workspace."}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group} aria-label={group}>
            <h2 className="mb-3 text-sm font-medium">{group}</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filtered
                .filter((item) => item.group === group)
                .map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center gap-3 rounded-lg border px-4 py-3 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <item.icon className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {item.label}
                    </span>
                    <ArrowRightIcon className="size-3.5 text-muted-foreground" />
                  </Link>
                ))}
            </div>
          </section>
        ))
      )}
    </Directory>
  )
}

export function ReportsDirectory() {
  return (
    <Directory
      title="Reports"
      description="Keep dashboards and saved analyses in one place."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reportPreviews.map((report) => (
          <Link
            key={report.id}
            to="/reports/$reportId"
            params={{ reportId: report.id }}
            className="flex flex-col gap-3 rounded-xl border p-5 hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <report.icon className="mb-2 size-5 text-muted-foreground" />
            <h2 className="font-medium">{report.label}</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {report.description}
            </p>
            <Badge variant="outline" className="mt-2 w-fit">
              Preview
            </Badge>
          </Link>
        ))}
      </div>
    </Directory>
  )
}

export function ReportPreview({
  report,
}: {
  report: (typeof reportPreviews)[number]
}) {
  return (
    <section aria-label={report.label} className="w-full p-page-gutter">
      <h1 className="sr-only">{report.label}</h1>
      <div className="flex items-center gap-3 rounded-xl border border-dashed px-5 py-4 text-xs text-muted-foreground">
        <Badge variant="outline">Preview</Badge>
        Live reporting isn't connected.
      </div>
    </section>
  )
}

export function ToolPreview({ tool }: { tool: (typeof toolPreviews)[number] }) {
  return (
    <section aria-label={tool.label} className="w-full p-page-gutter">
      <h1 className="sr-only">{tool.label}</h1>
      <div className="overflow-hidden rounded-xl border">
        <div className="grid gap-6 p-5 sm:grid-cols-2">
          <div>
            <h2 className="text-xs font-medium text-muted-foreground">
              START WITH
            </h2>
            <p className="mt-3 text-sm leading-6">{tool.input}</p>
          </div>
          <div>
            <h2 className="text-xs font-medium text-muted-foreground">
              GET BACK
            </h2>
            <p className="mt-3 text-sm leading-6">{tool.output}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t px-5 py-3 text-xs text-muted-foreground">
          <Badge variant="outline">Preview</Badge>
          Processing isn't connected.
        </div>
      </div>
    </section>
  )
}
