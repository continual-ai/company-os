import { CheckIcon, ChevronDownIcon, LinkIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "#/runtime/ui/components/button.tsx"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "#/runtime/ui/components/command.tsx"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "#/runtime/ui/components/popover.tsx"

export function RecordRelationshipPicker({
  relationships,
  selected,
  onSelect,
}: {
  readonly relationships: ReadonlyArray<{
    readonly key: string
    readonly label: string
  }>
  readonly selected: string | undefined
  readonly onSelect: (key: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="ghost" size="sm" className="max-w-48" />}
      >
        <span className="truncate">
          {relationships.find(({ key }) => key === selected)?.label ??
            "More relationships"}
        </span>
        <ChevronDownIcon />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 max-w-[calc(100vw-2rem)] p-0"
      >
        <Command>
          <CommandInput placeholder="Find a relationship…" />
          <CommandList>
            <CommandEmpty>No relationships found.</CommandEmpty>
            {relationships.map((item) => (
              <CommandItem
                key={item.key}
                value={item.label}
                onSelect={() => {
                  onSelect(item.key)
                  setOpen(false)
                }}
              >
                <LinkIcon />
                <span className="flex-1">{item.label}</span>
                {item.key === selected && <CheckIcon />}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
