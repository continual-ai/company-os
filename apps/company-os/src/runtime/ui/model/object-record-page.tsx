import { Button } from "@company/ui/button"
import { useLocalPreference } from "@company/ui/local-preferences"
import { PageContent, PageHeader, PageSectionHeader } from "@company/ui/page"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@company/ui/tabs"
import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  PencilIcon,
} from "lucide-react"
import { useMemo, useRef, useState } from "react"

import {
  ObjectActions,
  type ResolvedObjectUi,
} from "#/runtime/ui/model/module-ui.tsx"
import {
  modelObjectProperty,
  tableRecord,
  type ModelObject,
} from "#/runtime/ui/model/object-client.ts"
import { objectFormProperties } from "#/runtime/ui/model/object-form.ts"
import { ObjectPropertiesCard } from "#/runtime/ui/model/object-properties-card.tsx"
import { objectPropertyValue } from "#/runtime/ui/model/object-property-value.tsx"
import { ObjectRecordDialog } from "#/runtime/ui/model/object-record-dialog.tsx"
import { ObjectRecordIdentity } from "#/runtime/ui/model/object-record-identity.tsx"
import { ObjectRecordLayout } from "#/runtime/ui/model/object-record-layout.tsx"
import { ObjectRecordStatusProgress } from "#/runtime/ui/model/object-record-status-progress.tsx"
import { ObjectRelationshipCollection } from "#/runtime/ui/model/object-relationship-collection.tsx"
import { objectTablePropertySchema } from "#/runtime/ui/model/object-table/object-table-cell-types.ts"
import { objectTableValueText } from "#/runtime/ui/model/object-table/object-table-config.ts"
import { usePageChromeOverride } from "#/runtime/ui/model/page-chrome.tsx"
import { useRecordNavigation } from "#/runtime/ui/model/record-navigation.tsx"
import { RecordOptions } from "#/runtime/ui/model/record-options.tsx"
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

const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean"

type RecordUi = NonNullable<ResolvedObjectUi["record"]>

export function ObjectRecordPage({
  object,
  onTabChange,
  recordId,
  actions,
  overviewComponent: Overview,
  overviewRelationships,
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
  readonly overviewRelationships?: RecordUi["overviewRelationships"]
  readonly additionalTabs?: RecordUi["additionalTabs"]
  readonly properties?: RecordUi["properties"]
  readonly relationships?: RecordUi["relationships"]
  readonly tab?: string | undefined
}) {
  const runtime = useModelRuntime()
  const navigate = useNavigate()

  const pageElement = useRef<HTMLDivElement>(null)
  const state = useObjectRecord(object, recordId)
  const statusUpdate = useMutation({
    mutationFn: ({ field, value }: { field: string; value: string }) =>
      state.update({ [field]: value }),
  })
  const [showRelated, setShowRelated] = useLocalPreference(
    "record-related-visible",
    true,
    isBoolean
  )
  const [localTab, setLocalTab] = useState("overview")
  const [editing, setEditing] = useState<ReadonlyArray<string> | "all">()
  const allRelated = useMemo(
    () =>
      state.record ? recordRelationships(runtime, object, state.record) : [],
    [runtime, object, state.record]
  )
  const inlineRelationships = allRelated.filter(
    (item) => overviewRelationships?.[item.key]
  )
  const related = allRelated.filter(
    (item) => item.max !== 1 && !overviewRelationships?.[item.key]
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
    state.record,
    state.references
  )
  const totals = new Map(previews.map(({ key, total }) => [key, total]))
  const select = (value: string) => {
    // Let the router commit routed tabs inside its view transition.
    if (onTabChange) onTabChange(value)
    else setLocalTab(value)
  }
  const record = state.record
  const title = record ? recordTitle?.({ record, can: state.can }) : undefined
  const { navigation, collectionHref } = useRecordNavigation(
    object,
    recordId,
    record !== undefined
  )
  usePageChromeOverride({
    collectionHref,
    collectionLabel: object.pluralName,
    recordNavigation: navigation,
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
  const allFields = Object.keys(object.properties)
  const narrative = allFields.filter((id) => {
    const property = modelObjectProperty(object, id)
    if (!property || id === object.display.title || properties?.includes(id))
      return false
    const schema = objectTablePropertySchema(property)
    return (
      schema.kind === "string" &&
      (schema.format === "markdown" ||
        (schema.format === undefined &&
          (schema.maxLength === undefined || schema.maxLength > 300)))
    )
  })
  const statusField = object.display.status
  const hasStatusControl =
    statusField !== undefined &&
    modelObjectProperty(object, statusField)?.kind === "enum"
  const detailFields = [
    ...new Set([
      ...(properties ?? []),
      object.display.status,
      object.display.subtitle,
      ...allFields,
      ...allRelated
        .filter((relationship) => relationship.max === 1)
        .map((relationship) => relationship.key),
    ]),
  ].filter(
    (id): id is string =>
      id !== undefined &&
      id !== object.display.title &&
      id !== object.display.image &&
      !(hasStatusControl && id === statusField) &&
      !narrative.includes(id)
  )
  const requested = tab ?? localTab
  const active =
    related.some(({ key }) => key === requested) ||
    customTabs.some(({ id }) => id === requested)
      ? requested
      : "overview"
  const activeRelationship = related.find(({ key }) => key === active)
  const relationshipTabs =
    activeRelationship &&
    !visibleRelationships.some(({ key }) => key === active)
      ? [...visibleRelationships, activeRelationship]
      : visibleRelationships
  const edit = state.can("update")
    ? (id: string) => setEditing([id])
    : undefined

  const relatedPanel =
    related.length > 0 && showRelated ? (
      <aside
        id="record-related"
        aria-label="Related records"
        className="min-h-0 flex-1 overflow-y-auto text-xs/relaxed"
      >
        <PageContent>
          <RecordRelationshipPreviews previews={previews} onSelect={select} />
        </PageContent>
      </aside>
    ) : null

  const content = (
    <>
      <TabsContent
        value="overview"
        className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <ObjectRecordLayout sidebar={relatedPanel}>
          <PageContent className="min-h-0 flex-1 overflow-y-auto">
            {hasStatusControl && (
              <div className="min-w-0 rounded-lg bg-muted/40 p-page-gutter">
                <ObjectRecordStatusProgress
                  object={object}
                  record={tableRecord(object, record)}
                  onChange={
                    state.can("update")
                      ? (field, value) => statusUpdate.mutate({ field, value })
                      : undefined
                  }
                  pendingValue={
                    statusUpdate.isPending
                      ? statusUpdate.variables.value
                      : undefined
                  }
                  error={statusUpdate.error?.message}
                  disabled={editing !== undefined}
                />
              </div>
            )}
            {detailFields.length > 0 && (
              <section id="record-details" aria-label="Record properties">
                <ObjectPropertiesCard
                  object={object}
                  record={record}
                  references={state.references}
                  fields={detailFields}
                  onEdit={edit}
                />
              </section>
            )}
            {!Overview &&
              narrative.map((id) => (
                <section key={id} data-record-field={id}>
                  <PageSectionHeader>
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
                  </PageSectionHeader>
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
                author={state.references.get(
                  typeof record.createdBy === "string" ? record.createdBy : ""
                )}
                record={record}
                can={state.can}
              />
            )}
            {inlineRelationships.map((relationship) => {
              const Component = overviewRelationships![relationship.key]!
              return (
                <Component
                  key={`${record.id}:${relationship.key}`}
                  relationship={relationship}
                />
              )
            })}
            {detailFields.length === 0 &&
              narrative.length === 0 &&
              !Overview &&
              inlineRelationships.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No additional details.
                </p>
              )}
          </PageContent>
        </ObjectRecordLayout>
      </TabsContent>
      {related.map((relationship) => (
        <TabsContent
          key={relationship.key}
          value={relationship.key}
          className="m-0 flex min-h-80 flex-1 flex-col overflow-hidden @3xl:min-h-0"
        >
          {active === relationship.key && (
            <ObjectRelationshipCollection
              key={`${record.id}:${relationship.key}`}
              relationship={relationship}
            />
          )}
        </TabsContent>
      ))}
      {customTabs.map(({ id, component: Component }) => (
        <TabsContent
          key={id}
          value={id}
          className="m-0 min-h-0 flex-1 overflow-y-auto"
        >
          <PageContent>
            <Component record={record} can={state.can} />
          </PageContent>
        </TabsContent>
      ))}
    </>
  )

  return (
    <div
      ref={pageElement}
      className="@container flex min-h-0 flex-1 flex-col bg-background"
    >
      <Tabs
        value={active}
        onValueChange={select}
        className="min-h-0 min-w-0 flex-1 gap-0"
      >
        <PageHeader
          navigation={
            <>
              <div className="min-w-0 flex-1 overflow-x-auto">
                <TabsList variant="header">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  {relationshipTabs.map(({ key, label }) => (
                    <TabsTrigger key={key} value={key}>
                      {label}
                      <RelationshipCount count={totals.get(key)} />
                    </TabsTrigger>
                  ))}
                  {customTabs.map(({ id, label }) => (
                    <TabsTrigger key={id} value={id}>
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              {related.length > 0 && (
                <>
                  {otherRelationships.length > 0 && (
                    <RecordRelationshipPicker
                      relationships={otherRelationships}
                      selected={active}
                      onSelect={select}
                    />
                  )}
                  {active === "overview" && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={
                        showRelated
                          ? "Hide related records"
                          : "Show related records"
                      }
                      title={
                        showRelated
                          ? "Hide related records"
                          : "Show related records"
                      }
                      aria-expanded={showRelated}
                      aria-controls="record-related"
                      onClick={() => setShowRelated(!showRelated)}
                    >
                      {showRelated ? (
                        <PanelRightCloseIcon />
                      ) : (
                        <PanelRightOpenIcon />
                      )}
                    </Button>
                  )}
                </>
              )}
            </>
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="min-w-0 text-lg font-semibold tracking-tight wrap-break-word">
              {title ?? (
                <ObjectRecordIdentity
                  heading
                  object={object}
                  record={tableRecord(object, record)}
                />
              )}
            </h1>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <ObjectActions
                actions={actions}
                record={record}
                can={state.can}
                placement="record"
              />
              <RecordRelatedCreateMenu
                relationships={allRelated}
                totals={totals}
              />
              {edit && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Edit ${object.name.toLowerCase()}`}
                  disabled={editing !== undefined}
                  onClick={() => setEditing("all")}
                >
                  <PencilIcon />
                  Edit
                </Button>
              )}
              <RecordOptions
                key={record.id}
                value={record.id}
                label={
                  objectTableValueText(
                    tableRecord(object, record)[object.display.title]
                  ) || record.id
                }
                objectName={object.name}
                onDelete={
                  state.canDelete
                    ? async () => {
                        await state.deleteRecord()
                        await navigate({ to: collectionHref, replace: true })
                      }
                    : undefined
                }
              />
            </div>
          </div>
        </PageHeader>
        <div data-tab-content className="flex min-h-0 flex-1 flex-col">
          {content}
        </div>
      </Tabs>
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
