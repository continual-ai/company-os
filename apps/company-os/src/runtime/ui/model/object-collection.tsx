import { Button } from "@company/ui/button"
import { ConfirmActionButton } from "@company/ui/confirm-action-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@company/ui/select"
import { defaultStringifySearch } from "@tanstack/react-router"
import { functionalUpdate, type OnChangeFn } from "@tanstack/react-table"
import {
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  UnlinkIcon,
  LayersIcon,
} from "lucide-react"
import {
  lazy,
  Suspense,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react"

import {
  calendarDay,
  collectionDateWindow,
} from "#/runtime/ui/model/collection-dates.ts"
import { CollectionLayoutControl } from "#/runtime/ui/model/collection-layout-control.tsx"
import { CollectionPagination } from "#/runtime/ui/model/collection-pagination.tsx"
import { CollectionSearch } from "#/runtime/ui/model/collection-search.tsx"
import {
  type ObjectCollectionSearch,
  type ObjectCollectionView,
  type ObjectCollectionViewState,
} from "#/runtime/ui/model/collection-view.ts"
import {
  ObjectActions,
  type ResolvedObjectUi,
} from "#/runtime/ui/model/module-ui.tsx"
import {
  clientFor,
  parentName,
  modelObjectProperty,
  tableRecord,
  type ClientRecord,
  type ModelObject,
} from "#/runtime/ui/model/object-client.ts"
import {
  canFilterProperty,
  canSortProperty,
} from "#/runtime/ui/model/object-collection-query.ts"
import {
  emptyObjectCollectionViewState,
  objectCollectionStateSearch,
  resolveObjectCollectionView,
} from "#/runtime/ui/model/object-collection-view.ts"
import type { ObjectCreateOptions } from "#/runtime/ui/model/object-create-context.ts"
import { useObjectCreate } from "#/runtime/ui/model/object-create-context.ts"
import type { ObjectFormInput } from "#/runtime/ui/model/object-form.ts"
import { ObjectRecordDialog } from "#/runtime/ui/model/object-record-dialog.tsx"
import { ObjectRecordFeed } from "#/runtime/ui/model/object-record-feed.tsx"
import { objectHref } from "#/runtime/ui/model/object-routing.ts"
import { readFilterValue } from "#/runtime/ui/model/object-table/object-table-config.ts"
import { ObjectTable } from "#/runtime/ui/model/object-table/object-table.tsx"
import { type CollectionToolbarProps } from "#/runtime/ui/model/object-ui.ts"
import { useRememberCollection } from "#/runtime/ui/model/record-navigation.tsx"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"
import {
  useObjectCollection,
  type ObjectCollectionList,
} from "#/runtime/ui/model/use-object-collection.ts"

const CollectionVisual = lazy(() =>
  import("#/runtime/ui/model/collection-visual.tsx").then(
    ({ CollectionVisual: component }) => ({
      default: component,
    })
  )
)

interface ObjectCollectionSource {
  readonly list: ObjectCollectionList
  readonly create?: ObjectCreateOptions | undefined
  readonly renderAdd?:
    | ((records: ReadonlyArray<ClientRecord>) => ReactNode)
    | undefined
  readonly unlink?: ((record: ClientRecord) => Promise<void>) | undefined
  readonly deleteRecords?:
    | ((ids: ReadonlyArray<string>) => Promise<void>)
    | undefined
}
interface ObjectCollectionProps {
  readonly source?: ObjectCollectionSource | undefined
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
  source: suppliedSource,
  onSearchChange,
  actions,
  toolbarComponent: Toolbar,
  recordHref,
  search,
  views,
}: ObjectCollectionProps) {
  const runtime = useModelRuntime()

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
  const filters = viewState.filters
  const layout = viewState.layout ?? { type: "table" as const }
  const anchor =
    calendarDay(viewState.date) ?? new Date().toISOString().slice(0, 10)
  const window = collectionDateWindow(viewState.layout, anchor)
  const collection = useObjectCollection(
    object,
    filters,
    viewState.sorting,
    suppliedSource?.list,
    { window }
  )
  const openObjectCreate = useObjectCreate()
  useRememberCollection(
    suppliedSource === undefined
      ? {
          objectId: object.id,
          request: collection.request,
          href:
            objectHref(runtime, object) + defaultStringifySearch(activeSearch),
        }
      : undefined
  )
  const [editing, setEditing] = useState<ClientRecord>()
  const [mutationError, setMutationError] = useState<string>()
  const source: ObjectCollectionSource = suppliedSource ?? {
    list: clientFor(runtime, object).list,
    create: {},
    deleteRecords: collection.deleteRecords,
  }

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
  const create =
    collection.canCreate && source.create
      ? (values: ObjectFormInput = {}) =>
          openObjectCreate(object, {
            ...source.create,
            initialValues: { ...source.create?.initialValues, ...values },
          })
      : undefined
  const renderActions = (record: ClientRecord, selected = false) => (
    <>
      {collection.canUpdate(record.id) ? (
        <Button
          type="button"
          variant="ghost"
          size={selected ? "sm" : "icon-xs"}
          aria-label={`Edit ${object.name.toLowerCase()}`}
          onClick={() => setEditing(record)}
        >
          <PencilIcon />
          {selected && "Edit"}
        </Button>
      ) : null}
      {source.unlink && (
        <Button
          variant="ghost"
          size={selected ? "sm" : "icon-xs"}
          aria-label={`Unlink ${object.name.toLowerCase()}`}
          onClick={() => {
            setMutationError(undefined)
            void source.unlink!(record).catch((cause: unknown) =>
              setMutationError(
                cause instanceof Error
                  ? cause.message
                  : "Could not unlink the record."
              )
            )
          }}
        >
          <UnlinkIcon />
          {selected && "Unlink"}
        </Button>
      )}
      {!selected &&
      source.deleteRecords !== undefined &&
      collection.canDelete(record.id) ? (
        <ConfirmActionButton
          actionLabel="Delete"
          title={`Delete ${object.name.toLowerCase()}?`}
          description="This permanently deletes the record and its links."
          onConfirm={() => source.deleteRecords!([record.id])}
        />
      ) : null}
      <ObjectActions
        actions={actions}
        record={record}
        can={(action) => collection.can(action, record.id)}
        placement="row"
      />
    </>
  )
  const viewSelector =
    availableViews.length > 1 ? (
      <Select
        value={resolved.view.id}
        onValueChange={(viewId) => {
          if (viewId === null) return
          selectView(viewId)
        }}
      >
        <SelectTrigger
          aria-label={`${object.pluralName} view`}
          className="h-8 w-auto max-w-[min(20rem,60vw)] min-w-32 border-border/60 bg-muted/60 px-3 font-medium hover:bg-muted"
        >
          <LayersIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <SelectValue>{resolved.view.label}</SelectValue>
        </SelectTrigger>
        <SelectContent
          align="start"
          alignItemWithTrigger={false}
          className="min-w-48 p-1"
        >
          {availableViews.map((view) => (
            <SelectItem key={view.id} value={view.id}>
              {view.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : null
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

  const content = (
    <>
      {collection.error === undefined && mutationError === undefined ? null : (
        <div
          role="alert"
          className="flex items-center justify-between border-b border-destructive/30 bg-destructive/5 px-5 py-2 text-xs text-destructive"
        >
          <span>{collection.error ?? mutationError}</span>
          <Button
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
      {layout.type === "table" ? (
        <ObjectTable
          resetKey={collection.requestKey}
          object={object}
          parentLabel={parentName(runtime, object)}
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
          resolveRecord={(recordId) => collection.references.get(recordId)}
          onCellCommit={collection.updateCell}
          canUpdateRecord={collection.canUpdate}
          onCreateRecord={create === undefined ? undefined : () => create()}
          onDeleteRecords={
            source.deleteRecords !== undefined &&
            collection.records.some(({ id }) => collection.canDelete(id))
              ? source.deleteRecords
              : undefined
          }
          canDeleteRecord={collection.canDelete}
          toolbarActions={source.renderAdd?.(collection.records)}
          pagination={{
            hasNextPage: collection.hasNextPage,
            error: collection.error,
            loading: collection.loading,
            onNextPage: collection.nextPage,
            totalSize: collection.totalSize,
          }}

          tableTitle={
            <div className="flex flex-wrap items-center gap-2">
              {viewSelector}
              {layoutControls}
            </div>
          }
          renderSelectedRecordActions={(recordId) => {
            const original = collection.records.find(
              ({ id }) => id === recordId
            )
            return original === undefined ? null : renderActions(original, true)
          }}
        />
      ) : (
        <>
          <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
            <div className="flex flex-wrap items-center gap-2">
              {viewSelector}
              {layoutControls}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {create && (
                <Button onClick={() => create()}>
                  <PlusIcon />
                  New {object.name.toLowerCase()}
                </Button>
              )}
              {source.renderAdd?.(collection.records)}
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
          {layout.type === "feed" ? (
            <ObjectRecordFeed
              items={collection.records.map((record) => ({ object, record }))}
              label={object.pluralName}
              loading={collection.loading}
              recordHref={recordHref}
              renderActions={renderActions}
            />
          ) : (
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
                  references: collection.references,
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
          )}
          <CollectionPagination
            loaded={collection.records.length}
            totalSize={collection.totalSize}
            hasNextPage={collection.hasNextPage}
            loading={collection.loading}
            error={collection.error}
            onNextPage={collection.nextPage}
          />
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
    </>
  )
  return content
}
