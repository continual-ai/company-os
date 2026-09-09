import {
  CalendarDaysIcon,
  ListIcon,
  ChartGanttIcon,
  Columns3Icon,
  Table2Icon,
  Settings2Icon,
} from "lucide-react"

import type { ObjectType } from "#/runtime/model/index.ts"
import { Button } from "#/runtime/ui/components/button.tsx"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "#/runtime/ui/components/popover.tsx"
import {
  collectionLayoutFields,
  defaultCollectionLayout,
  type CollectionLayout,
} from "#/runtime/ui/model/collection-layout.ts"

const layouts = [
  { type: "feed", label: "Feed", icon: ListIcon },
  { type: "table", label: "Table", icon: Table2Icon },
  { type: "kanban", label: "Kanban", icon: Columns3Icon },
  { type: "calendar", label: "Calendar", icon: CalendarDaysIcon },
  { type: "gantt", label: "Gantt", icon: ChartGanttIcon },
] as const

export function CollectionLayoutControl({
  object,
  layout,
  onChange,
  columns,
  onColumnsChange,
}: {
  object: ObjectType
  columns: ReadonlyArray<string>
  onColumnsChange: (columns: ReadonlyArray<string>) => void
  layout: CollectionLayout
  onChange: (layout: CollectionLayout) => void
}) {
  const { groups, dates } = collectionLayoutFields(object)
  const active = layouts.find(({ type }) => type === layout.type)!
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="secondary"
            className="border-border/60 bg-muted/60 hover:bg-muted"
          />
        }
      >
        <active.icon />
        {active.label}
        <Settings2Icon className="size-3" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-4">
        <div className="grid grid-cols-2 gap-1" aria-label="Collection layout">
          {layouts.map(({ type, label, icon: Icon }) => (
            <Button
              key={type}
              variant={layout.type === type ? "secondary" : "ghost"}
              className="justify-start"
              size="sm"
              aria-pressed={layout.type === type}
              disabled={defaultCollectionLayout(object, type) === undefined}
              onClick={() => {
                if (type === layout.type) return
                const next = defaultCollectionLayout(object, type)
                if (next) onChange(next)
              }}
            >
              <Icon />
              {label}
            </Button>
          ))}
        </div>
        {layout.type === "kanban" ? (
          <FieldSelect
            label="Group by"
            value={layout.groupBy}
            fields={groups}
            onChange={(groupBy) => onChange({ ...layout, groupBy })}
          />
        ) : layout.type !== "table" && layout.type !== "feed" ? (
          <>
            <FieldSelect
              label="Start date"
              value={layout.start}
              fields={dates.filter(([id]) => id !== layout.end)}
              onChange={(start) => onChange({ ...layout, start })}
            />
            <FieldSelect
              label="End date"
              value={layout.end ?? ""}
              optional={layout.type === "calendar"}
              fields={dates.filter(([id]) => id !== layout.start)}
              onChange={(end) =>
                onChange(
                  end
                    ? { ...layout, end }
                    : { type: "calendar", start: layout.start }
                )
              }
            />
          </>
        ) : null}
        {layout.type === "kanban" && (
          <fieldset className="space-y-2 border-t pt-3">
            <legend className="text-xs font-medium">
              Card fields · up to four
            </legend>
            <div className="max-h-44 space-y-2 overflow-y-auto">
              {Object.entries(object.properties)
                .filter(([id]) => id !== object.display.title)
                .map(([id, field]) => (
                  <label key={id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={columns.includes(id)}
                      disabled={!columns.includes(id) && columns.length >= 4}
                      onChange={(event) =>
                        onColumnsChange(
                          event.target.checked
                            ? [...columns, id]
                            : columns.filter((column) => column !== id)
                        )
                      }
                    />
                    {field.label ?? id}
                  </label>
                ))}
            </div>
          </fieldset>
        )}
        <p className="text-xs text-muted-foreground">
          Changes apply to this URL. Shared views are defined in code.
        </p>
      </PopoverContent>
    </Popover>
  )
}
function FieldSelect({
  label,
  value,
  fields,
  optional,
  onChange,
}: {
  label: string
  value: string
  fields: ReturnType<typeof collectionLayoutFields>["dates"]
  optional?: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium">
      {label}
      <select
        className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-ring"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {optional && <option value="">None · single date</option>}
        {fields.map(([id, field]) => (
          <option key={id} value={id}>
            {field.label ?? id}
          </option>
        ))}
      </select>
    </label>
  )
}
