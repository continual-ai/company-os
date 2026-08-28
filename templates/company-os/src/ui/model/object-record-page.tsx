import { Model } from "@company/model"
import { modelObjectLinkTraversals } from "@company/runtime"
import { Button } from "@company/ui/components/button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@company/ui/components/tabs"
import { ArrowLeftIcon, PencilIcon } from "lucide-react"
import { useCallback, useState, type ReactNode } from "react"

import { usePageChromeOverride } from "@/ui/application/page-chrome"

import { recordLabel, tableRecord, type ModelObject } from "./object-client"
import { ObjectPropertiesCard } from "./object-properties-card"
import { ObjectRecordDialog } from "./object-record-dialog"
import { ObjectRelationshipPanel } from "./object-relationships"
import { objectTableValueText } from "./object-table/object-table-config"
import { useObjectRecord } from "./use-object-record"

interface RecordActionContext {
  readonly can: (actionId: string) => boolean
  readonly record: ReturnType<typeof tableRecord>
  readonly refresh: () => Promise<void>
}

export function ObjectRecordPage({
  object,
  onTabChange,
  recordId,
  renderActions,
  tab,
}: {
  readonly object: ModelObject
  readonly onTabChange?: ((tab: string) => void) | undefined
  readonly recordId: string
  readonly renderActions?:
    | ((context: RecordActionContext) => ReactNode)
    | undefined
  readonly tab?: string | undefined
}) {
  const recordState = useObjectRecord(object, recordId)
  const [editing, setEditing] = useState(false)
  const [relationshipTotals, setRelationshipTotals] = useState<{
    readonly recordId: string
    readonly totals: Readonly<Record<string, number>>
  }>({ recordId, totals: {} })
  const updateRelationshipTotal = useCallback(
    (traversalKey: string, totalSize: number) =>
      setRelationshipTotals((current) => {
        const totals: Record<string, number> =
          current.recordId === recordId ? { ...current.totals } : {}
        totals[traversalKey] = totalSize
        return { recordId, totals }
      }),
    [recordId]
  )
  const record = recordState.record
  const label = record === undefined ? undefined : recordLabel(object, record)
  usePageChromeOverride({ breadcrumb: label })

  if (recordState.loading && record === undefined) {
    return (
      <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">
        Loading {object.name.toLowerCase()}…
      </div>
    )
  }
  if (record === undefined) {
    return (
      <section className="grid min-h-64 place-items-center p-6 text-center">
        <div>
          <h1 className="text-lg font-semibold">{object.name} unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {recordState.error ?? "The record could not be loaded."}
          </p>
          <Button
            className="mt-5"
            variant="outline"
            nativeButton={false}
            render={
              <a
                aria-label={`Back to ${object.pluralName.toLowerCase()}`}
                href={`/${object.collection}`}
              />
            }
          >
            <ArrowLeftIcon /> Back to {object.pluralName.toLowerCase()}
          </Button>
        </div>
      </section>
    )
  }

  const projected = tableRecord(object, record)
  const traversals = modelObjectLinkTraversals(Model, object)
  const activeTab =
    tab !== undefined &&
    traversals.some(({ traversal }) => traversal.key === tab)
      ? tab
      : "overview"
  const visibleRelationshipTotals =
    relationshipTotals.recordId === recordId ? relationshipTotals.totals : {}

  return (
    <Tabs
      className="min-h-0 flex-1 gap-0 overflow-y-auto bg-muted/20"
      value={activeTab}
      onValueChange={(value) => onTabChange?.(value)}
    >
      <header className="border-b bg-background">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{object.name}</p>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">
              {label}
            </h1>
            {object.display.subtitle === undefined ? null : (
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {objectTableValueText(projected[object.display.subtitle])}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {renderActions?.({
              can: recordState.can,
              record: projected,
              refresh: recordState.load,
            })}
            {recordState.can("update") ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
              >
                <PencilIcon /> Edit
              </Button>
            ) : null}
          </div>
        </div>
        <div className="overflow-x-auto px-5">
          <TabsList variant="line" className="h-10 gap-4 p-0">
            <TabsTrigger value="overview" className="h-10 px-0">
              Overview
            </TabsTrigger>
            {traversals.map(({ traversal }) => (
              <TabsTrigger
                key={traversal.key}
                value={traversal.key}
                className="h-10 px-0"
              >
                {traversal.label}
                {visibleRelationshipTotals[traversal.key] ===
                undefined ? null : (
                  <span className="text-muted-foreground tabular-nums">
                    {visibleRelationshipTotals[traversal.key]}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </header>

      <TabsContent value="overview" className="m-0">
        <div className="mx-auto w-full max-w-6xl p-4 sm:p-5">
          <ObjectPropertiesCard
            object={object}
            record={record}
            referenceLabels={recordState.referenceLabels}
          />
        </div>
      </TabsContent>

      {traversals.map((traversal) => (
        <TabsContent
          key={traversal.traversal.key}
          value={traversal.traversal.key}
          className="m-0"
          keepMounted
        >
          <div className="mx-auto w-full max-w-6xl p-4 sm:p-5">
            <ObjectRelationshipPanel
              canUpdate={recordState.can("update")}
              object={object}
              onTotalSizeChange={updateRelationshipTotal}
              record={record}
              traversal={traversal}
            />
          </div>
        </TabsContent>
      ))}

      {editing ? (
        <ObjectRecordDialog
          mode="edit"
          object={object}
          open
          record={record}
          referenceLabels={recordState.referenceLabels}
          onOpenChange={setEditing}
          onSave={recordState.update}
        />
      ) : null}
    </Tabs>
  )
}
