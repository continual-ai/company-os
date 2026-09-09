import { PencilIcon, PanelLeftIcon } from "lucide-react"
import { useMemo, useRef, useState } from "react"

import { Button } from "#/runtime/ui/components/button.tsx"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "#/runtime/ui/components/tabs.tsx"
import {
  ObjectActions,
  type ResolvedObjectUi,
} from "#/runtime/ui/model/module-ui.tsx"
import {
  tableRecord,
  recordLabel,
  modelObjectProperty,
  type ModelObject,
} from "#/runtime/ui/model/object-client.ts"
import { objectFormProperties } from "#/runtime/ui/model/object-form.ts"
import { ObjectPropertiesCard } from "#/runtime/ui/model/object-properties-card.tsx"
import { objectPropertyValue } from "#/runtime/ui/model/object-property-value.tsx"
import { ObjectRecordDialog } from "#/runtime/ui/model/object-record-dialog.tsx"
import { ObjectRecordIdentity } from "#/runtime/ui/model/object-record-identity.tsx"
import { ObjectRelationshipCollection } from "#/runtime/ui/model/object-relationship-collection.tsx"
import { objectHref } from "#/runtime/ui/model/object-routing.ts"
import { objectTablePropertySchema } from "#/runtime/ui/model/object-table/object-table-cell-types.ts"
import { usePageChromeOverride } from "#/runtime/ui/model/page-chrome.tsx"
import { RecordIdentifier } from "#/runtime/ui/model/record-identifier.tsx"
import { RecordRelatedCreateMenu } from "#/runtime/ui/model/record-related-create-menu.tsx"
import { RecordRelationshipPicker } from "#/runtime/ui/model/record-relationship-picker.tsx"
import {
  RecordRelationshipPreviews,
  RelationshipCount,
} from "#/runtime/ui/model/record-relationship-previews.tsx"
import { recordRelationships } from "#/runtime/ui/model/record-relationships.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"
import { useObjectRecord } from "#/runtime/ui/model/use-object-record.ts"
import { useRecordRelationshipPreviews } from "#/runtime/ui/model/use-record-relationship-previews.ts"

type RecordUi = NonNullable<ResolvedObjectUi["record"]>

export function ObjectRecordPage({
  object,
  onTabChange,
  recordId,
  actions,
  overviewComponent: Overview,
  title: recordTitle,
  additionalTabs: customTabs = [],
  properties,
  relationships,
  tab,
}: {
  readonly object: ModelObject
  readonly onTabChange?: ((tab: string) => void) | undefined
  readonly recordId: string
  readonly actions?: ResolvedObjectUi["actions"]
  readonly title?: RecordUi["title"]
  readonly overviewComponent?: RecordUi["overviewComponent"]
  readonly additionalTabs?: RecordUi["additionalTabs"]
  readonly properties?: RecordUi["properties"]
  readonly relationships?: RecordUi["relationships"]
  readonly tab?: string | undefined
}) {
  const runtime = useModelRuntime()

  const pageElement = useRef<HTMLDivElement>(null)
  const state = useObjectRecord(object, recordId)
  const [showDetails, setShowDetails] = useState(true)
  const [localTab, setLocalTab] = useState("overview")
  const [editing, setEditing] = useState<ReadonlyArray<string> | "all">()
  const related = useMemo(
    () =>
      state.record ? recordRelationships(runtime, object, state.record) : [],
    [runtime, object, state.record]
  )
  const preferred =
    relationships === undefined
      ? related.filter((item) => item.featured)
      : relationships.flatMap((key) =>
          related.filter((item) => item.key === key)
        )
  const visibleRelationships = (
    preferred.length > 0 ? preferred : related
  ).slice(0, 4)
  const otherRelationships = related.filter(
    (item) => !visibleRelationships.some(({ key }) => key === item.key)
  )
  const previews = useRecordRelationshipPreviews(
    visibleRelationships,
    state.record !== undefined
  )
  const totals = new Map(previews.map(({ key, total }) => [key, total]))
  const select = (value: string) => {
    setLocalTab(value)
    onTabChange?.(value)
  }
  const record = state.record
  const title = record ? recordTitle?.({ record, can: state.can }) : undefined
  usePageChromeOverride({
    breadcrumb: title ?? (record ? recordLabel(object, record) : object.name),
    collectionHref: objectHref(runtime, object),
    collectionLabel: object.pluralName,
  })
  if (!record)
    return (
      <div className="grid min-h-64 place-items-center p-6 text-center text-sm text-muted-foreground">
        {state.loading ? (
          `Loading ${object.name.toLowerCase()}…`
        ) : (
          <div>
            <p>{state.error ?? `${object.name} unavailable`}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => void state.reload()}
            >
              Retry
            </Button>
          </div>
        )}
      </div>
    )

  const writableFields = new Set(
    objectFormProperties(object, "edit").map(({ id }) => id)
  )
  const allFields = [
    ...(object.parent.kind === "root" ? [] : ["parent"]),
    ...Object.keys(object.properties),
  ]
  const narrative = allFields.filter((id) => {
    const property = modelObjectProperty(object, id)
    if (!property || id === object.display.title || properties?.includes(id))
      return false
    const schema = objectTablePropertySchema(property)
    return (
      schema.kind === "string" &&
      schema.format === undefined &&
      (schema.maxLength === undefined || schema.maxLength > 300)
    )
  })
  const detailFields = [
    ...new Set([
      ...(properties ?? []),
      object.display.status,
      object.display.subtitle,
      ...allFields,
    ]),
  ].filter(
    (id): id is string =>
      id !== undefined &&
      id !== object.display.title &&
      id !== object.display.image &&
      !narrative.includes(id)
  )
  const hasOverview =
    Overview !== undefined || narrative.length > 0 || related.length > 0
  const hasWorkspace =
    hasOverview || related.length > 0 || customTabs.length > 0
  const defaultTab = hasOverview
    ? "overview"
    : (visibleRelationships[0]?.key ?? customTabs[0]?.id ?? "overview")
  const requested = tab ?? localTab
  const active =
    (requested === "overview" && hasOverview) ||
    related.some(({ key }) => key === requested) ||
    customTabs.some(({ id }) => id === requested)
      ? requested
      : defaultTab
  const edit = state.can("update")
    ? (id: string) => setEditing([id])
    : undefined

  return (
    <div
      ref={pageElement}
      className="@container flex min-h-0 flex-1 flex-col bg-background"
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div className="min-w-0">
          <h1 className="min-w-0 text-xl tracking-tight">
            {title !== undefined ? (
              title
            ) : (
              <ObjectRecordIdentity
                object={object}
                record={tableRecord(object, record)}
                className="max-w-full [&>span:first-child]:size-9 [&>span:last-child]:text-xl"
              />
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ObjectActions
            actions={actions}
            record={record}
            can={state.can}
            placement="record"
          />
          {hasWorkspace && detailFields.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={showDetails}
              aria-controls="record-details"
              onClick={() => setShowDetails(!showDetails)}
            >
              <PanelLeftIcon />
              Details
            </Button>
          )}
          <RecordRelatedCreateMenu relationships={related} totals={totals} />
          {edit && (
            <Button
              variant="outline"
              size="sm"
              disabled={editing !== undefined}
              onClick={() => setEditing("all")}
            >
              <PencilIcon />
              Edit record
            </Button>
          )}
          <RecordIdentifier value={record.id} />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto @3xl:flex-row @3xl:overflow-hidden">
        {detailFields.length > 0 && (!hasWorkspace || showDetails) && (
          <aside
            id="record-details"
            className={
              hasWorkspace
                ? "shrink-0 border-b px-3 py-3 @3xl:w-88 @3xl:overflow-y-auto @3xl:border-r @3xl:border-b-0"
                : "w-full max-w-3xl p-4"
            }
          >
            <h2 className="mb-2 px-2 text-xs font-semibold text-muted-foreground">
              Details
            </h2>
            <ObjectPropertiesCard
              object={object}
              record={record}
              references={state.references}
              fields={detailFields}
              onEdit={edit}
            />
          </aside>
        )}
        {hasWorkspace && (
          <Tabs
            value={active}
            onValueChange={select}
            className="min-h-80 min-w-0 flex-1 gap-0 @3xl:min-h-0"
          >
            <div className="flex shrink-0 items-center gap-2 border-b px-4">
              <div className="min-w-0 flex-1 overflow-x-auto">
                <TabsList variant="line" className="h-10 gap-4 p-0">
                  {hasOverview && (
                    <TabsTrigger value="overview" className="h-10 px-0">
                      Overview
                    </TabsTrigger>
                  )}
                  {visibleRelationships.map(({ key, label }) => (
                    <TabsTrigger key={key} value={key} className="h-10 px-0">
                      {label}
                      <RelationshipCount
                        count={previews.find((item) => item.key === key)?.total}
                      />
                    </TabsTrigger>
                  ))}
                  {customTabs.map(({ id, label }) => (
                    <TabsTrigger key={id} value={id} className="h-10 px-0">
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              {otherRelationships.length > 0 && (
                <RecordRelationshipPicker
                  relationships={otherRelationships}
                  selected={active}
                  onSelect={select}
                />
              )}
            </div>
            <TabsContent value="overview" className="m-0 overflow-y-auto p-5">
              {!Overview &&
                narrative.map((id) => (
                  <section key={id} data-record-field={id} className="mb-6">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold">
                        {modelObjectProperty(object, id)?.label ?? id}
                      </h2>
                      {edit && writableFields.has(id) && (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label={`Edit ${modelObjectProperty(object, id)?.label ?? id}`}
                          disabled={editing !== undefined}
                          onClick={() => edit(id)}
                        >
                          <PencilIcon />
                        </Button>
                      )}
                    </div>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">
                      {objectPropertyValue(
                        runtime,
                        object,
                        id,
                        tableRecord(object, record)[id],
                        state.references
                      )}
                    </div>
                  </section>
                ))}
              {Overview && (
                <Overview
                  author={state.referenceLabels.get(
                    typeof record.createdBy === "string" ? record.createdBy : ""
                  )}
                  record={record}
                  can={state.can}
                />
              )}
              <RecordRelationshipPreviews
                previews={previews}
                onSelect={select}
              />
            </TabsContent>
            {related.map((relationship) => {
              const { key } = relationship
              return (
                <TabsContent
                  key={key}
                  value={key}
                  className="m-0 flex min-h-80 flex-col overflow-hidden @3xl:min-h-0"
                >
                  {active === key && (
                    <ObjectRelationshipCollection
                      key={`${record.id}:${key}`}
                      relationship={relationship}
                    />
                  )}
                </TabsContent>
              )
            })}
            {customTabs.map(({ id, component: Component }) => (
              <TabsContent
                key={id}
                value={id}
                className="m-0 overflow-y-auto p-5"
              >
                <Component record={record} can={state.can} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
      {editing !== undefined && (
        <ObjectRecordDialog
          mode="edit"
          object={object}
          open
          record={record}
          fields={editing === "all" ? undefined : editing}
          referenceLabels={state.referenceLabels}
          onOpenChange={(open) => {
            if (!open) {
              const field = editing === "all" ? undefined : editing[0]
              setEditing(undefined)
              if (field !== undefined)
                requestAnimationFrame(() =>
                  pageElement.current
                    ?.querySelector<HTMLElement>(
                      `[data-record-field="${CSS.escape(field)}"] [aria-label^="Edit "]`
                    )
                    ?.focus()
                )
            }
          }}
          onSave={state.update}
        />
      )}
    </div>
  )
}
