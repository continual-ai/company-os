import { Button } from "@company/ui/button"
import { useQuery } from "@tanstack/react-query"
import { PencilIcon } from "lucide-react"
import { useState } from "react"

import type { ModelLinkTraversal, ObjectType } from "#/runtime/model/index.ts"
import { linkPreview } from "#/runtime/model/record-links.ts"
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
  const [open, setOpen] = useState(false)
  const { ids, totalSize } = linkPreview(record.links?.[link.traversal.key])
  return (
    <div className="group/link relative flex h-8 min-w-0 items-center px-2 pr-7 text-xs">
      <RecordLinkValue
        ids={ids}
        totalSize={totalSize}
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
      {open && (
        <ObjectTableLinkEditor
          object={object}
          recordId={record.id}
          relationship={link.traversal.key}
          onOpenChange={setOpen}
        />
      )}
    </div>
  )
}

function ObjectTableLinkEditor({
  object,
  recordId,
  relationship,
  onOpenChange,
}: {
  object: ObjectType
  recordId: string
  relationship: string
  onOpenChange: (open: boolean) => void
}) {
  const runtime = useModelRuntime()
  const client = clientFor(runtime, object)
  const current = useQuery(client.get({ id: recordId }))
  return (
    <>
      {current.data && (
        <ObjectRecordDialog
          mode="edit"
          object={object}
          record={current.data}
          fields={[relationship]}
          referenceLabels={new Map()}
          open
          onOpenChange={onOpenChange}
          onSave={async (input) => {
            await client.update?.({ ...input, id: recordId })
          }}
        />
      )}
      {current.isError && (
        <button
          type="button"
          className="text-destructive"
          onClick={() => void current.refetch()}
        >
          Retry loading
        </button>
      )}
    </>
  )
}
