import { Button } from "@company/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@company/ui/dropdown-menu"
import { ChevronDownIcon, PlusIcon } from "lucide-react"

import { useObjectCreate } from "#/runtime/ui/model/object-create-context.ts"
import { ObjectIcon } from "#/runtime/ui/model/object-record-identity.tsx"
import type { RecordRelationship } from "#/runtime/ui/model/record-relationships.ts"

/** Creation defaults and authority come from the same relationship projection as its collection. */
export function RecordRelatedCreateMenu({
  relationships,
  totals,
  compact = false,
}: {
  readonly relationships: ReadonlyArray<RecordRelationship>
  readonly totals: ReadonlyMap<string, number | undefined>
  readonly compact?: boolean
}) {
  const openCreate = useObjectCreate()
  const entries = relationships
    .filter(
      (item) =>
        totals.has(item.key) &&
        (item.cardinality === "many" || totals.get(item.key) === 0)
    )
    .flatMap((item) =>
      item.creates.map((create) => ({
        ...create,
        key: `${item.key}:${create.target.id}`,
        label: item.label,
      }))
    )
  const available = entries
  if (available.length === 0) return null
  const single = compact && available.length === 1 ? available[0] : undefined
  if (single)
    return (
      <Button
        variant="ghost"
        size="sm"
        aria-label={`New ${single.target.name.toLowerCase()}`}
        onClick={() => openCreate(single.target, single.options)}
      >
        <PlusIcon />
        New
      </Button>
    )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={compact ? "ghost" : "outline"}
            size="sm"
            aria-label={
              compact
                ? `New ${relationships[0]?.label.toLowerCase()}`
                : undefined
            }
          />
        }
      >
        <PlusIcon />
        {compact ? "New" : "New related"}
        <ChevronDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 min-w-60">
        {available.map(({ key, label, target, options }) => (
          <DropdownMenuItem
            key={key}
            onClick={() => openCreate(target, options)}
          >
            <ObjectIcon object={target} />
            <span className="flex-1">New {target.name.toLowerCase()}</span>
            {label.toLowerCase() !== target.pluralName.toLowerCase() && (
              <span className="text-xs text-muted-foreground">{label}</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
