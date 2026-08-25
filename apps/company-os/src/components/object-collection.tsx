import { Button } from "@company/ui/components/button"
import { PencilIcon } from "lucide-react"
import { useState, type ReactNode } from "react"

import {
  parentName,
  tableRecord,
  type ClientRecord,
  type ModelObject,
} from "./object-client"
import { canFilterProperty, canSortProperty } from "./object-collection-query"
import { ObjectRecordDialog } from "./object-record-dialog"
import { ObjectTable } from "./object-table/object-table"
import type { ObjectTableRecord } from "./object-table/object-table-config"
import { useObjectCollection } from "./use-object-collection"

export function ObjectCollection({
  object,
  renderRecordActions,
  renderCollectionActions,
}: {
  readonly object: ModelObject
  readonly renderRecordActions?:
    | ((record: ObjectTableRecord, refresh: () => Promise<void>) => ReactNode)
    | undefined
  readonly renderCollectionActions?:
    | ((refresh: () => Promise<void>) => ReactNode)
    | undefined
}) {
  const collection = useObjectCollection(object)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<ClientRecord>()

  if (collection.loading && collection.records.length === 0) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Loading {object.pluralName.toLowerCase()}…
      </div>
    )
  }

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
        onCellCommit={collection.canUpdate ? collection.updateCell : undefined}
        onCreateRecord={
          collection.canCreate ? () => setCreateOpen(true) : undefined
        }
        onDeleteRecords={
          collection.canDelete ? collection.deleteRecords : undefined
        }
        pagination={{
          hasNextPage: collection.hasNextPage,
          hasPreviousPage: collection.hasPreviousPage,
          loading: collection.loading,
          onNextPage: collection.nextPage,
          onPreviousPage: collection.previousPage,
          pageIndex: collection.pageIndex,
        }}
        toolbarActions={renderCollectionActions?.(collection.load)}
        renderRecordActions={(record) => {
          const source = collection.records.find(({ id }) => id === record.id)
          return (
            <>
              {collection.canUpdate && source !== undefined ? (
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
              {renderRecordActions?.(record, collection.load)}
            </>
          )
        }}
      />

      {collection.canCreate ? (
        <ObjectRecordDialog
          key={`${object.id}-create`}
          mode="create"
          object={object}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSave={collection.create}
          referenceLabels={collection.referenceLabels}
        />
      ) : null}
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
    </>
  )
}
