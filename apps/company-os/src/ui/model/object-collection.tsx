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
import {
  LinkIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  ChevronRightIcon,
} from "lucide-react"
import { lazy, Suspense, useMemo, useState, type ComponentType } from "react"

import { calendarDay, collectionDateWindow } from "./collection-dates"
import { CollectionLayoutControl } from "./collection-layout-control"
import { CollectionSearch } from "./collection-search"
import {
  ObjectActions,
  type ResolvedObjectUi,
  type CollectionToolbarProps,
} from "./module-ui"
import {
  parentName,
  modelObjectProperty,
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

const CollectionVisual = lazy(() =>
  import("./collection-visual").then(({ CollectionVisual: component }) => ({
    default: component,
  }))
)

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
  const filters = [...fixedFilters, ...viewState.filters]
  const layout = viewState.layout ?? { type: "table" as const }
  const anchor =
    calendarDay(viewState.date) ?? new Date().toISOString().slice(0, 10)
  const window = collectionDateWindow(viewState.layout, anchor)
  const collection = useObjectCollection(
    object,
    filters,
    viewState.sorting,
    undefined,
    { window, append: layout.type !== "table" }
  )
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

  const selectView = (viewId: string) => {
    if (onSearchChange === undefined) setLocalSearch({ view: viewId })
    else onSearchChange({ view: viewId })
  }
  const create = collection.canCreate
    ? (values: ObjectFormInput = {}) =>
        openObjectCreate(object, {
          initialValues: { ...createInitialValues, ...values },
          referenceLabels: createReferenceLabels,
        })
    : undefined
  const renderActions = (source: ClientRecord) => (
    <>
      {collection.canUpdate(source.id) ? (
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
      {hasRelationships && collection.can("get", source.id) ? (
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
      <ObjectActions
        actions={actions}
        record={source}
        can={(action) => collection.can(action, source.id)}
        placement="row"
      />
    </>
  )
  const viewSelector = (
    <Select
      value={resolved.view.id}
      onValueChange={(viewId) => {
        if (viewId === null) return
        selectView(viewId)
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
  )
  const layoutControls = (
    <>
      {activeSearch.state !== undefined && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => selectView(resolved.view.id)}
        >
          <RotateCcwIcon />
          Reset view
        </Button>
      )}
      <CollectionLayoutControl
        object={object}
        layout={layout}
        columns={Object.keys(columnVisibility)
          .filter((id) => columnVisibility[id] && id !== object.display.title)
          .slice(0, 4)}
        onColumnsChange={(columns) =>
          updateState({
            ...viewState,
            visibility: Object.fromEntries(
              [object.display.title, ...columns].map((id) => [id, true])
            ),
          })
        }
        onChange={(next) => updateState({ ...viewState, layout: next })}
      />
      {Toolbar && (
        <Toolbar
          object={object}
          search={{ view: resolved.view.id, state: viewState }}
          can={collection.can}
        />
      )}
    </>
  )

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
      {layout.type === "table" ? (
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
          onCreateRecord={create === undefined ? undefined : () => create()}
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
          toolbarActions={layoutControls}
          tableTitle={viewSelector}
          renderRecordActions={(record) => {
            const source = collection.records.find(({ id }) => id === record.id)
            return source === undefined ? null : renderActions(source)
          }}
        />
      ) : (
        <>
          <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
            {viewSelector}
            <div className="flex flex-wrap items-center gap-2">
              {layoutControls}
              {create && (
                <Button size="sm" onClick={() => create()}>
                  <PlusIcon />
                  New {object.name.toLowerCase()}
                </Button>
              )}
            </div>
          </header>
          <div className="border-b px-4 py-2">
            <CollectionSearch
              label={object.pluralName}
              value={
                viewState.filters.find(
                  (filter) =>
                    filter.id === object.display.title &&
                    filter.value.operator === "contains"
                )?.value.values[0] ?? ""
              }
              onChange={(value) =>
                updateState({
                  ...viewState,
                  filters: [
                    ...viewState.filters.filter(
                      (filter) =>
                        filter.id !== object.display.title ||
                        filter.value.operator !== "contains"
                    ),
                    ...(value
                      ? [
                          {
                            id: object.display.title,
                            value: {
                              operator: "contains" as const,
                              values: [value],
                            },
                          },
                        ]
                      : []),
                  ],
                })
              }
            />
          </div>
          {viewState.filters.length > 0 && (
            <div className="flex flex-wrap gap-2 border-b px-4 py-2">
              {viewState.filters.map((filter, index) => (
                <Button
                  key={`${filter.id}:${index}`}
                  variant="secondary"
                  size="xs"
                  onClick={() =>
                    updateState({
                      ...viewState,
                      filters: viewState.filters.filter((_, i) => i !== index),
                    })
                  }
                >
                  {modelObjectProperty(object, filter.id)?.label ?? filter.id}:{" "}
                  {filter.value.values.join(", ") || filter.value.operator} ×
                </Button>
              ))}
            </div>
          )}
          <Suspense
            fallback={
              <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">
                Loading view…
              </div>
            }
          >
            <CollectionVisual
              presentation={{
                object,
                recordHref,
                referenceLabels: collection.referenceLabels,
                columns: Object.keys(columnVisibility).filter(
                  (id) => columnVisibility[id]
                ),
                canMove: (record) => collection.canUpdate(record.id),
                canEdit: (record) => collection.canUpdate(record.id),
                onEdit: setEditing,
                renderActions,
              }}
              records={collection.records}
              layout={layout}
              anchor={anchor}
              onDateChange={(date) => updateState({ ...viewState, date })}
              onUpdate={collection.update}
              onCreate={create}
              loading={collection.loading}
            />
          </Suspense>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground">
            <span>
              {collection.records.length} shown · {collection.totalSize}{" "}
              matching records
              {layout.type === "kanban" ? "" : " in this window or unscheduled"}
              {collection.hasNextPage || collection.hasPreviousPage
                ? " · Counts reflect loaded records"
                : ""}
            </span>
            {collection.hasNextPage && (
              <Button
                variant="outline"
                size="sm"
                disabled={collection.loading}
                onClick={collection.nextPage}
              >
                {collection.loading ? "Loading…" : "Load more"}
                <ChevronRightIcon />
              </Button>
            )}
          </footer>
        </>
      )}

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
