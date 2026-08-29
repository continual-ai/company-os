import type { ListRequest, ModelLinkTraversal } from "@company/runtime"
import { Button } from "@company/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@company/ui/components/dialog"
import { PencilIcon, PlusIcon, UnlinkIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import {
  clientFor,
  linkClientFor,
  parentName,
  tableRecord,
  type ClientRecord,
  type DynamicLinkClient,
  type ModelObject,
} from "./object-client"
import type {
  ObjectCollectionFilter,
  ObjectCollectionSort,
} from "./object-collection-view"
import { ObjectRecordDialog } from "./object-record-dialog"
import { loadRelationshipCollectionPage } from "./object-relationship-collection-query"
import { ObjectRelationshipForm } from "./object-relationship-form"
import { ObjectTable } from "./object-table/object-table"
import { useObjectCollection } from "./use-object-collection"

const noFilters: ReadonlyArray<ObjectCollectionFilter> = []
const noSorting: ReadonlyArray<ObjectCollectionSort> = []
const unavailable = () => false

function AddRelationshipDialog({
  link,
  object,
  onLinked,
  recordId,
  traversal,
}: {
  readonly link: NonNullable<DynamicLinkClient["link"]>
  readonly object: ModelObject
  readonly onLinked: () => Promise<void>
  readonly recordId: string
  readonly traversal: ModelLinkTraversal
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" size="sm" />}>
        <PlusIcon />
        Add {object.name}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add {object.name.toLowerCase()}</DialogTitle>
          <DialogDescription>
            Select an existing {object.name.toLowerCase()} to connect.
          </DialogDescription>
        </DialogHeader>
        <ObjectRelationshipForm
          link={link}
          recordId={recordId}
          traversal={traversal}
          onLinked={async () => {
            await onLinked()
            setOpen(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

export function ObjectRelationshipCollection({
  canUpdate,
  object,
  onTotalSizeChange,
  record,
  targetObject,
  traversal,
}: {
  readonly canUpdate: boolean
  readonly object: ModelObject
  readonly onTotalSizeChange?:
    | ((traversalKey: string, totalSize: number) => void)
    | undefined
  readonly record: ClientRecord
  readonly targetObject: ModelObject
  readonly traversal: ModelLinkTraversal
}) {
  const relationshipClient = useMemo(
    () => linkClientFor(object, traversal),
    [object, traversal]
  )
  const targetClient = useMemo(() => clientFor(targetObject), [targetObject])
  const listRecords = useCallback(
    (request: ListRequest) =>
      loadRelationshipCollectionPage({
        batchGet: targetClient.batchGet,
        list: relationshipClient.list,
        objectType: targetObject.id,
        request,
        sourceId: record.id,
      }),
    [record.id, relationshipClient.list, targetClient.batchGet, targetObject.id]
  )
  const collection = useObjectCollection(
    targetObject,
    noFilters,
    noSorting,
    listRecords
  )
  const [editing, setEditing] = useState<ClientRecord>()
  const [mutationError, setMutationError] = useState<string>()
  const link = canUpdate ? relationshipClient.link : undefined
  const unlink = canUpdate ? relationshipClient.unlink : undefined
  const recordsById = useMemo(
    () => new Map(collection.records.map((item) => [item.id, item])),
    [collection.records]
  )
  const tableRecords = useMemo(
    () => collection.records.map((item) => tableRecord(targetObject, item)),
    [collection.records, targetObject]
  )

  useEffect(() => {
    if (collection.loading || collection.error !== undefined) return
    onTotalSizeChange?.(traversal.traversal.key, collection.totalSize)
  }, [
    collection.error,
    collection.loading,
    collection.totalSize,
    onTotalSizeChange,
    traversal.traversal.key,
  ])

  const canAdd =
    link !== undefined &&
    !collection.loading &&
    (traversal.traversal.cardinality === "many" ||
      collection.records.length === 0)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {collection.error === undefined && mutationError === undefined ? null : (
        <div
          role="alert"
          className="flex items-center justify-between border-b border-destructive/30 bg-destructive/5 px-5 py-2 text-xs text-destructive"
        >
          <span>{collection.error ?? mutationError}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setMutationError(undefined)
              void collection.load()
            }}
          >
            Retry
          </Button>
        </div>
      )}
      <ObjectTable
        object={targetObject}
        parentLabel={parentName(targetObject)}
        records={tableRecords}
        canFilterProperty={unavailable}
        canSortProperty={unavailable}
        canUpdateRecord={collection.canUpdate}
        enableRowSelection={false}
        onCellCommit={collection.updateCell}
        pagination={{
          hasNextPage: collection.hasNextPage,
          hasPreviousPage: collection.hasPreviousPage,
          loading: collection.loading,
          onNextPage: collection.nextPage,
          onPreviousPage: collection.previousPage,
          totalSize: collection.totalSize,
        }}
        recordHref={(recordId) => `/${targetObject.collection}/${recordId}`}
        resolveRecordLabel={(recordId) =>
          collection.referenceLabels.get(recordId)
        }
        tableTitle={
          <span className="truncate text-muted-foreground">
            {traversal.traversal.description ?? traversal.traversal.label}
          </span>
        }
        toolbarActions={
          canAdd && link !== undefined ? (
            <AddRelationshipDialog
              link={link}
              object={targetObject}
              recordId={record.id}
              traversal={traversal}
              onLinked={collection.load}
            />
          ) : undefined
        }
        renderRecordActions={(tableItem) => {
          const source = recordsById.get(tableItem.id)
          return (
            <>
              {source !== undefined && collection.canUpdate(source.id) ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Edit ${targetObject.name.toLowerCase()}`}
                  onClick={() => setEditing(source)}
                >
                  <PencilIcon />
                </Button>
              ) : null}
              {unlink === undefined ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Unlink ${targetObject.name.toLowerCase()}`}
                  disabled={collection.loading}
                  onClick={() => {
                    setMutationError(undefined)
                    void unlink({ id: record.id, target: tableItem.id })
                      .then(() => collection.load())
                      .catch((cause: unknown) =>
                        setMutationError(
                          cause instanceof Error
                            ? cause.message
                            : `${traversal.traversal.label} could not be unlinked.`
                        )
                      )
                  }}
                >
                  <UnlinkIcon />
                </Button>
              )}
            </>
          )
        }}
      />

      {editing === undefined ? null : (
        <ObjectRecordDialog
          key={editing.id}
          mode="edit"
          object={targetObject}
          open
          record={editing}
          referenceLabels={collection.referenceLabels}
          onOpenChange={(open) => !open && setEditing(undefined)}
          onSave={(changes) => collection.update(editing, changes)}
        />
      )}
    </div>
  )
}
