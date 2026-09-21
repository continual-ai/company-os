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
import { type RecordLinkView } from "#/runtime/ui/model/record-link-views.ts"

/** Creation defaults and authority come from the same link projection as its collection. */
export function RecordRelatedCreateMenu({
  links,
  compact = false,
}: {
  readonly links: ReadonlyArray<RecordLinkView>
  readonly compact?: boolean
}) {
  const openCreate = useObjectCreate()
  const available = links.flatMap((item) =>
    item.creates.map((create) => ({
      ...create,
      key: `${item.key}:${create.target.id}`,
      label: item.label,
    }))
  )
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
              compact ? `New ${links[0]?.label.toLowerCase()}` : undefined
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
