import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@company/ui/components/dialog"

import type { ClientRecord, ModelObject } from "./object-client"
import { ObjectRelationships } from "./object-relationships"

export function ObjectRelationshipsDialog({
  canUpdate,
  object,
  onOpenChange,
  open,
  record,
}: {
  readonly canUpdate: boolean
  readonly object: ModelObject
  readonly onOpenChange: (open: boolean) => void
  readonly open: boolean
  readonly record: ClientRecord
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{object.name} relationships</DialogTitle>
          <DialogDescription>
            View and manage records related to this {object.name.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>
        <ObjectRelationships
          canUpdate={canUpdate}
          object={object}
          record={record}
        />
      </DialogContent>
    </Dialog>
  )
}
