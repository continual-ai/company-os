import { Button } from "@company/ui/button"
import { useQuery } from "@tanstack/react-query"
import { PencilIcon } from "lucide-react"
import { useState } from "react"

import type { ModelLinkTraversal, ObjectType } from "#/runtime/model/index.ts"
import { clientFor } from "#/runtime/ui/model/object-client.ts"
import { ObjectRecordDialog } from "#/runtime/ui/model/object-record-dialog.tsx"
import type {
  ObjectTableRecord,
  ObjectTableRecordResolver,
} from "#/runtime/ui/model/object-table/object-table-config.ts"
import { RecordLinkValue } from "#/runtime/ui/model/record-link-value.tsx"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

export function ObjectTableLinkCell({
  object,
  record,
  link,
  resolveRecord,
  editable,
}: {
  readonly object: ObjectType
  readonly record: ObjectTableRecord
  readonly link: ModelLinkTraversal
  readonly resolveRecord: ObjectTableRecordResolver | undefined
  readonly editable: boolean
}) {
  const runtime = useModelRuntime()
  const client = clientFor(runtime, object)
  const [open, setOpen] = useState(false)
  const current = useQuery({ ...client.get({ id: record.id }), enabled: open })
  const value = record[link.traversal.key]
  const ids = Array.isArray(value) ? value : []
  const total = record[`${link.traversal.key}TotalSize`]
  return (
    <div className="group/link relative flex h-8 min-w-0 items-center px-2 pr-7 text-xs">
      <RecordLinkValue
        ids={ids}
        totalSize={typeof total === "number" ? total : ids.length}
        resolveRecord={resolveRecord}
      />
      {editable && link.writable && (
        <Button
          size="icon-xs"
          variant="ghost"
          className="absolute right-0 opacity-0 group-hover/link:opacity-100 focus-visible:opacity-100"
          aria-label={`Edit ${link.traversal.label}`}
          onClick={() => setOpen(true)}
        >
          <PencilIcon />
        </Button>
      )}
      {open && current.data && (
        <ObjectRecordDialog
          mode="edit"
          object={object}
          record={current.data}
          fields={[link.traversal.key]}
          referenceLabels={new Map()}
          open
          onOpenChange={setOpen}
          onSave={async (input) => {
            await client.update?.({ ...input, id: record.id })
          }}
        />
      )}
      {open && current.isError && (
        <button
          type="button"
          className="text-destructive"
          onClick={() => void current.refetch()}
        >
          Retry loading
        </button>
      )}
    </div>
  )
}
