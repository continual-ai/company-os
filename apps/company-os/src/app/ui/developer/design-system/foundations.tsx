import { Button } from "@company/ui/button"

import { Example } from "#/app/ui/developer/design-system/example.tsx"

export function Foundations() {
  return (
    <div className="space-y-8">
      <Example title="Semantic colors" source="packages/ui/src/styles.css">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[
            ["Background", "bg-background text-foreground"],
            ["Card", "bg-card text-card-foreground"],
            ["Primary", "bg-primary text-primary-foreground"],
            ["Secondary", "bg-secondary text-secondary-foreground"],
            ["Muted", "bg-muted text-muted-foreground"],
            ["Accent", "bg-accent text-accent-foreground"],
            ["Popover", "bg-popover text-popover-foreground"],
            ["Sidebar", "bg-sidebar text-sidebar-foreground"],
            ["Destructive", "bg-destructive text-white"],
          ].map(([name, color]) => (
            <div
              key={name}
              className={`rounded-md border p-5 text-sm ${color}`}
            >
              {name}
            </div>
          ))}
        </div>
        <div className="mt-5 flex gap-3" aria-label="Chart palette">
          {[1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="flex-1 space-y-2">
              <div
                className="h-12 rounded-sm"
                style={{ background: `var(--chart-${index})` }}
              />
              <p className="text-xs text-muted-foreground">Chart {index}</p>
            </div>
          ))}
        </div>
      </Example>
      <Example
        title="Interaction accent"
        source="packages/ui/src/styles.css · --control · --ring"
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Blue identifies keyboard focus and checked controls. Primary actions
          and surfaces stay neutral.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="size-4 rounded-sm bg-control" aria-hidden="true" />
            Checked control
          </div>
          <div className="rounded-md border border-ring px-4 py-3 text-sm ring-1 ring-ring/50">
            Focus ring
          </div>
          <Button>Primary action</Button>
        </div>
      </Example>
      <Example title="Typography" source="packages/ui/src/styles.css · Geist">
        <div className="space-y-5">
          <p className="text-3xl font-semibold tracking-tight">
            Your company, in focus.
          </p>
          <p className="text-xl font-semibold tracking-tight">
            Review the next step
          </p>
          <p className="text-sm leading-6">
            Every record brings the work, its context, and the next decision
            together.
          </p>
          <p className="text-xs text-muted-foreground">
            Updated a moment ago · Secondary information
          </p>
          <p className="font-mono text-xs tabular-nums">52,500.00 USD</p>
        </div>
      </Example>
      <Example
        title="Shape and density"
        source="packages/ui/src/styles.css · @company/ui/button"
      >
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            ["Small", "rounded-sm"],
            ["Controls", "rounded-md"],
            ["Surfaces", "rounded-lg"],
            ["Dialogs", "rounded-xl"],
          ].map(([name, radius]) => (
            <div
              key={name}
              className={`border bg-muted/40 p-5 text-sm ${radius}`}
            >
              {name}
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                {radius}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button size="xs">Extra small</Button>
          <Button size="sm">Small</Button>
          <Button>Default</Button>
          <Button size="lg">Large</Button>
        </div>
      </Example>
    </div>
  )
}
