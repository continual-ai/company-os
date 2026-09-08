import { Button } from "@company/ui/components/button"
import type { CollectionLayout } from "@company/ui/model/collection-layout"
import { PlusIcon } from "lucide-react"

import {
  CollectionCard,
  CollectionDropZone,
  type CollectionPresentation,
} from "#/ui/model/collection-card.tsx"
import {
  modelObjectProperty,
  type ClientRecord,
} from "#/ui/model/object-client.ts"
import type { ObjectFormInput } from "#/ui/model/object-form.ts"

export function CollectionKanban({
  presentation,
  records,
  layout,
  onCreate,
}: {
  presentation: CollectionPresentation
  records: ReadonlyArray<ClientRecord>
  layout: Extract<CollectionLayout, { type: "kanban" }>
  onCreate?: ((values: ObjectFormInput) => void) | undefined
}) {
  const field = modelObjectProperty(presentation.object, layout.groupBy)
  if (field?.kind !== "enum") return null
  const choices: Array<{ value: string | null; label: string }> = [
    ...(field.options ??
      field.values.map((value) => ({ value, label: value }))),
  ]
  if (field.nullable) choices.push({ value: null, label: "Unassigned" })
  return (
    <div className="flex min-h-[28rem] flex-1 items-stretch gap-4 overflow-x-auto bg-muted/20 p-4 sm:p-5">
      {choices.map((choice, index) => {
        const items = records.filter(
          (record) => (record[layout.groupBy] ?? null) === choice.value
        )
        return (
          <CollectionDropZone
            key={JSON.stringify(choice.value)}
            id={JSON.stringify(["group", choice.value])}
            value={choice.value}
            className="flex w-[min(82vw,19rem)] shrink-0 flex-col rounded-lg border bg-muted/35"
          >
            <header className="flex items-center gap-2 p-3">
              <span
                className="size-2 rounded-full"
                style={{ background: `var(--chart-${(index % 5) + 1})` }}
              />
              <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
                {choice.label}
              </h2>
              <span className="rounded bg-background px-1.5 text-xs text-muted-foreground tabular-nums">
                {items.length}
              </span>
              {onCreate && (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Create in ${choice.label}`}
                  onClick={() => onCreate({ [layout.groupBy]: choice.value })}
                >
                  <PlusIcon />
                </Button>
              )}
            </header>
            <div className="flex-1 space-y-2 px-2 pb-2">
              {items.map((record) => (
                <CollectionCard
                  key={record.id}
                  record={record}
                  presentation={presentation}
                />
              ))}
              {items.length === 0 && (
                <p className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
                  No records in this column
                </p>
              )}
            </div>
            {onCreate && (
              <Button
                className="m-2 justify-start text-muted-foreground"
                variant="ghost"
                size="sm"
                onClick={() => onCreate({ [layout.groupBy]: choice.value })}
              >
                <PlusIcon />
                Add {presentation.object.name.toLowerCase()}
              </Button>
            )}
          </CollectionDropZone>
        )
      })}
    </div>
  )
}
