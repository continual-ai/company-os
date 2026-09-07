import { Button } from "@company/ui/components/button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@company/ui/components/tabs"
import { PencilIcon, PanelLeftIcon } from "lucide-react"
import { useMemo, useRef, useState } from "react"

import { usePageChromeOverride } from "@/ui/application/page-chrome"

import { ObjectActions, type ResolvedObjectUi } from "./module-ui"
import {
  tableRecord,
  recordLabel,
  modelObjectProperty,
  type ModelObject,
} from "./object-client"
import { objectFormProperties } from "./object-form"
import { ObjectPropertiesCard } from "./object-properties-card"
import { objectPropertyValue } from "./object-property-value"
import { ObjectRecordDialog } from "./object-record-dialog"
import { ObjectRecordIdentity } from "./object-record-identity"
import { ObjectRelationshipCollection } from "./object-relationship-collection"
import { objectHref } from "./object-routing"
import { objectTablePropertySchema } from "./object-table/object-table-cell-types"
import { RecordIdentifier } from "./record-identifier"
import { RecordRelatedCreateMenu } from "./record-related-create-menu"
import { RecordRelationshipPicker } from "./record-relationship-picker"
import {
  RecordRelationshipPreviews,
  RelationshipCount,
} from "./record-relationship-previews"
import { recordRelationships } from "./record-relationships"
import { useObjectRecord } from "./use-object-record"
import { useRecordRelationshipPreviews } from "./use-record-relationship-previews"

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
  const pageElement = useRef<HTMLDivElement>(null)
  const state = useObjectRecord(object, recordId)
  const [showDetails, setShowDetails] = useState(true)
  const [localTab, setLocalTab] = useState("overview")
  const [editing, setEditing] = useState<ReadonlyArray<string> | "all">()
  const related = useMemo(
    () => (state.record ? recordRelationships(object, state.record) : []),
    [object, state.record]
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
    collectionHref: objectHref(object),
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
