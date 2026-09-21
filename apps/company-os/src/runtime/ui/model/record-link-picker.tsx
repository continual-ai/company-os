import { Button } from "@company/ui/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@company/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@company/ui/popover"
import { CheckIcon, ChevronDownIcon, LinkIcon } from "lucide-react"
import { useState } from "react"

export function RecordLinkPicker({
  links,
  selected,
  onSelect,
}: {
  readonly links: ReadonlyArray<{
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
          {links.find(({ key }) => key === selected)?.label ??
            "More related records"}
        </span>
        <ChevronDownIcon />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 max-w-[calc(100vw-2rem)] p-0"
      >
        <Command>
          <CommandInput placeholder="Find related records…" />
          <CommandList>
            <CommandEmpty>No related records found.</CommandEmpty>
            {links.map((item) => (
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
