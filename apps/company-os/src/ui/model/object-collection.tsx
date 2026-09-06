import { modelObjectLinkTraversals } from "@company/runtime"
import { Button } from "@company/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@company/ui/components/select"
import { functionalUpdate, type OnChangeFn } from "@tanstack/react-table"
import { Model } from "company-os/model"
import { LinkIcon, PencilIcon } from "lucide-react"
import { useMemo, useState, type ComponentType } from "react"

import {
  ObjectActions,
  type ResolvedObjectUi,
  type CollectionToolbarProps,
} from "./module-ui"
import {
  parentName,
  tableRecord,
  type ClientRecord,
  type ModelObject,
} from "./object-client"
import { canFilterProperty, canSortProperty } from "./object-collection-query"
import {
  emptyObjectCollectionViewState,
  objectCollectionStateSearch,
  resolveObjectCollectionView,
  type ObjectCollectionFilter,
  type ObjectCollectionSearch,
  type ObjectCollectionView,
  type ObjectCollectionViewState,
} from "./object-collection-view"
import { useObjectCreate } from "./object-create-context"
import type { ObjectFormInput } from "./object-form"
import { ObjectRecordDialog } from "./object-record-dialog"
import { ObjectRelationshipsDialog } from "./object-relationships-dialog"
import { ObjectTable } from "./object-table/object-table"
import { readFilterValue } from "./object-table/object-table-config"
import { useObjectCollection } from "./use-object-collection"

const noFixedFilters: ReadonlyArray<ObjectCollectionFilter> = []
interface ObjectCollectionProps {
  readonly fixedFilters?: ReadonlyArray<ObjectCollectionFilter> | undefined
  readonly createInitialValues?: ObjectFormInput | undefined
  readonly createReferenceLabels?: ReadonlyMap<string, string> | undefined
  readonly object: ModelObject
  readonly onSearchChange?:
    | ((search: ObjectCollectionSearch) => void)
    | undefined
  readonly search?: ObjectCollectionSearch | undefined
  readonly recordHref?: ((recordId: string) => string) | undefined
  readonly views?: ReadonlyArray<ObjectCollectionView> | undefined
  readonly actions?: ResolvedObjectUi["actions"]
  readonly toolbarComponent?: ComponentType<CollectionToolbarProps> | undefined
}

export function ObjectCollection({
  object,
  fixedFilters = noFixedFilters,
  createInitialValues,
  createReferenceLabels,
  onSearchChange,
  actions,
  toolbarComponent: Toolbar,
  recordHref,
  search,
  views,
}: ObjectCollectionProps) {
  const fallbackView = useMemo<ObjectCollectionView>(
    () => ({
      id: "all",
      label: `All ${object.pluralName.toLowerCase()}`,
      state: emptyObjectCollectionViewState,
    }),
    [object.pluralName]
  )
  const availableViews = views ?? [fallbackView]
  const [localSearch, setLocalSearch] = useState<ObjectCollectionSearch>(
    search ?? {}
  )
  const activeSearch =
    onSearchChange === undefined ? localSearch : (search ?? {})
  const resolved = resolveObjectCollectionView(availableViews, activeSearch)
  const viewState = resolved.state
  const filters = useMemo(
    () => [...fixedFilters, ...viewState.filters],
    [fixedFilters, viewState.filters]
  )
  const collection = useObjectCollection(object, filters, viewState.sorting)
  const openObjectCreate = useObjectCreate()
  const [editing, setEditing] = useState<ClientRecord>()
  const [relating, setRelating] = useState<ClientRecord>()
  const hasRelationships = modelObjectLinkTraversals(Model, object).length > 0
  const propertyIds = [
    ...(object.parent.kind === "root" ? [] : ["parent"]),
    ...Object.keys(object.properties),
  ]
  const configuredVisibility = Object.keys(viewState.visibility).length > 0
  const columnVisibility = Object.fromEntries(
    propertyIds.map((propertyId) => [
      propertyId,
      configuredVisibility ? viewState.visibility[propertyId] === true : true,
    ])
  )
  const updateState = (next: ObjectCollectionViewState) => {
    const nextSearch = objectCollectionStateSearch(resolved.view, next)
    if (onSearchChange === undefined) setLocalSearch(nextSearch)
    else onSearchChange(nextSearch)
  }
  const onColumnVisibilityChange: OnChangeFn<Record<string, boolean>> = (
    update
  ) =>
    updateState({
      ...viewState,
      visibility: functionalUpdate(update, columnVisibility),
    })

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
        columnFilters={[...viewState.filters]}
        columnVisibility={columnVisibility}
        sorting={[...collection.sorting]}
        onColumnFiltersChange={(update) =>
          updateState({
            ...viewState,
            filters: functionalUpdate(update, [...viewState.filters]).map(
              (filter) => ({
                id: filter.id,
                value: readFilterValue(filter.value),
              })
            ),
          })
        }
        onColumnVisibilityChange={onColumnVisibilityChange}
        onSortingChange={(update) =>
          updateState({
            ...viewState,
            sorting: functionalUpdate(update, [...viewState.sorting]),
          })
        }
        recordHref={recordHref}
        resolveRecordLabel={(recordId) =>
          collection.referenceLabels.get(recordId)
        }
        onCellCommit={collection.updateCell}
        canUpdateRecord={collection.canUpdate}
        onCreateRecord={
          collection.canCreate
            ? () =>
                openObjectCreate(object, {
                  initialValues: createInitialValues,
                  referenceLabels: createReferenceLabels,
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
          totalSize: collection.totalSize,
        }}
        toolbarActions={
          Toolbar ? (
            <Toolbar
              object={object}
              search={{ view: resolved.view.id, state: viewState }}
              can={collection.can}
            />
          ) : undefined
        }
        tableTitle={
          <Select
            value={resolved.view.id}
            onValueChange={(viewId) => {
              if (viewId === null) return
              if (onSearchChange === undefined) setLocalSearch({ view: viewId })
              else onSearchChange({ view: viewId })
            }}
          >
            <SelectTrigger
              aria-label={`${object.pluralName} view`}
              size="sm"
              className="h-7 w-auto min-w-32 border-0 bg-transparent px-1 shadow-none"
            >
              <SelectValue>{resolved.view.label}</SelectValue>
            </SelectTrigger>
            <SelectContent align="start">
              {availableViews.map((view) => (
                <SelectItem key={view.id} value={view.id}>
                  {view.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
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
              {source && (
                <ObjectActions
                  actions={actions}
                  record={source}
                  can={(action) => collection.can(action, record.id)}
                  placement="row"
                />
              )}
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
