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
import { useCapabilities } from "#/runtime/ui/model/use-capabilities.ts"

/** Creation defaults and authority come from the same relationship projection as its collection. */
export function RecordRelatedCreateMenu({
  relationships,
  totals,
}: {
  readonly relationships: ReadonlyArray<RecordRelationship>
  readonly totals: ReadonlyMap<string, number | undefined>
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
  const capabilities = useCapabilities(entries.flatMap((entry) => entry.checks))
  const available = entries.filter((entry) =>
    entry.checks.every(capabilities.can)
  )
  if (available.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <PlusIcon />
        New related
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
