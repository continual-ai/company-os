import { presentation } from "#/app/app-presentation.ts"
import { CommandGroup, CommandItem } from "#/runtime/ui/components/command.tsx"
import { tableRecord } from "#/runtime/ui/model/object-client.ts"
import { ObjectRecordIdentity } from "#/runtime/ui/model/object-record-identity.tsx"
import { objectHref } from "#/runtime/ui/model/object-routing.ts"
import { useRecentRecords } from "#/runtime/ui/model/recent-records.tsx"

/** Session suggestions reflect explicit navigation and current read access. */
export function RecentRecords({
  onOpen,
}: {
  readonly onOpen: (href: string) => void
}) {
  const records = useRecentRecords()
  if (records.length === 0) return null
  return (
    <CommandGroup heading="Recent records">
      {records.map(({ object, record }) => (
        <CommandItem
          key={record.id}
          value={`recent:${record.id}`}
          onSelect={() => onOpen(objectHref(presentation, object, record.id))}
          className="gap-3 px-3 py-2.5"
        >
          <ObjectRecordIdentity
            object={object}
            record={tableRecord(object, record)}
            className="min-w-0 flex-1"
          />
          <span className="text-xs text-muted-foreground">{object.name}</span>
        </CommandItem>
      ))}
    </CommandGroup>
  )
}
