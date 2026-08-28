import { Model } from "@company/model"
import { modelObjectLinkTraversals } from "@company/runtime"
import { Button } from "@company/ui/components/button"
import { LinkIcon, PencilIcon } from "lucide-react"
import { useState, type ReactNode } from "react"

import { CapabilityBoundary } from "@/ui/application/capability-boundary"

import {
  parentName,
  tableRecord,
  type ClientRecord,
  type ModelObject,
} from "./object-client"
import { canFilterProperty, canSortProperty } from "./object-collection-query"
import { useObjectCreate } from "./object-create-context"
import { ObjectRecordDialog } from "./object-record-dialog"
import { ObjectRelationshipsDialog } from "./object-relationships-dialog"
import { ObjectTable } from "./object-table/object-table"
import type { ObjectTableRecord } from "./object-table/object-table-config"
import { useObjectCollection } from "./use-object-collection"

interface CollectionActionContext {
  readonly can: (actionId: string, target?: string) => boolean
  readonly refresh: () => Promise<void>
}

interface RecordActionContext {
  readonly can: (actionId: string) => boolean
  readonly refresh: () => Promise<void>
}

interface ObjectCollectionProps {
  readonly object: ModelObject
  readonly renderRecordActions?:
    | ((record: ObjectTableRecord, context: RecordActionContext) => ReactNode)
    | undefined
  readonly renderCollectionActions?:
    | ((context: CollectionActionContext) => ReactNode)
    | undefined
}

export function ObjectCollection(props: ObjectCollectionProps) {
  return (
    <CapabilityBoundary
      permission={`${props.object.id}.list`}
      title={`No access to ${props.object.pluralName.toLowerCase()}`}
      description={`This identity cannot view ${props.object.pluralName.toLowerCase()}. Ask an administrator to grant access if this work should be available.`}
    >
      <AuthorizedObjectCollection {...props} />
    </CapabilityBoundary>
  )
}

function AuthorizedObjectCollection({
  object,
  renderRecordActions,
  renderCollectionActions,
}: ObjectCollectionProps) {
  const collection = useObjectCollection(object)
  const openObjectCreate = useObjectCreate()
  const [editing, setEditing] = useState<ClientRecord>()
  const [relating, setRelating] = useState<ClientRecord>()
  const hasRelationships = modelObjectLinkTraversals(Model, object).length > 0

  return (
    <>
      {collection.error === undefined ? null : (
        <div
          role="alert"
          className="flex items-center justify-between border-b border-destructive/30 bg-destructive/5 px-5 py-2 text-xs text-destructive"
        >
          <span>{collection.error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void collection.load()}
          >
            Retry
          </Button>
        </div>
      )}
      <ObjectTable
        object={object}
        parentLabel={parentName(object)}
        records={collection.records.map((record) =>
          tableRecord(object, record)
        )}
        canFilterProperty={canFilterProperty}
        canSortProperty={canSortProperty}
        columnFilters={collection.columnFilters}
        sorting={collection.sorting}
        onColumnFiltersChange={collection.onColumnFiltersChange}
        onSortingChange={collection.onSortingChange}
        resolveRecordLabel={(recordId) =>
          collection.referenceLabels.get(recordId)
        }
        onCellCommit={collection.updateCell}
        canUpdateRecord={collection.canUpdate}
        onCreateRecord={
          collection.canCreate
            ? () =>
                openObjectCreate(object, {
                  onCreated: () => void collection.load(),
                })
            : undefined
        }
        onDeleteRecords={
          collection.records.some(({ id }) => collection.canDelete(id))
            ? collection.deleteRecords
            : undefined
        }
        canDeleteRecord={collection.canDelete}
        pagination={{
          hasNextPage: collection.hasNextPage,
          hasPreviousPage: collection.hasPreviousPage,
          loading: collection.loading,
          onNextPage: collection.nextPage,
          onPreviousPage: collection.previousPage,
          pageIndex: collection.pageIndex,
        }}
        toolbarActions={renderCollectionActions?.({
          can: collection.can,
          refresh: collection.load,
        })}
        renderRecordActions={(record) => {
          const source = collection.records.find(({ id }) => id === record.id)
          return (
            <>
              {collection.canUpdate(record.id) && source !== undefined ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Edit ${object.name.toLowerCase()}`}
                  onClick={() => setEditing(source)}
                >
                  <PencilIcon />
                </Button>
              ) : null}
              {hasRelationships &&
              source !== undefined &&
              collection.can("get", record.id) ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Manage ${object.name.toLowerCase()} relationships`}
                  onClick={() => setRelating(source)}
                >
                  <LinkIcon />
                </Button>
              ) : null}
              {renderRecordActions?.(record, {
                can: (actionId) => collection.can(actionId, record.id),
                refresh: collection.load,
              })}
            </>
          )
        }}
      />

      {editing === undefined ? null : (
        <ObjectRecordDialog
          key={editing.id}
          mode="edit"
          object={object}
          open
          record={editing}
          onOpenChange={(open) => !open && setEditing(undefined)}
          onSave={(changes) => collection.update(editing, changes)}
          referenceLabels={collection.referenceLabels}
        />
      )}
      {relating === undefined ? null : (
        <ObjectRelationshipsDialog
          key={`${relating.id}-relationships`}
          canUpdate={collection.canUpdate(relating.id)}
          object={object}
          open
          record={relating}
          onOpenChange={(open) => !open && setRelating(undefined)}
        />
      )}
    </>
  )
}
