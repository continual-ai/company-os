import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { UnlinkIcon } from "lucide-react"
import { useState, type ReactNode } from "react"

import { modelCollectionQuery } from "#/client/model-collection-query.ts"
import { Button } from "#/ui/components/button.tsx"
import { CollectionPagination } from "#/ui/model/collection-pagination.tsx"
import { useObjectUi } from "#/ui/model/module-ui.tsx"
import {
  type ClientRecord,
  type ModelObject,
} from "#/ui/model/object-client.ts"
import { ObjectCollection } from "#/ui/model/object-collection.tsx"
import { ObjectRecordFeed } from "#/ui/model/object-record-feed.tsx"
import { ObjectReferenceSelect } from "#/ui/model/object-reference-select.tsx"
import { objectHref } from "#/ui/model/object-routing.ts"
import { RecordRelatedCreateMenu } from "#/ui/model/record-related-create-menu.tsx"
import type { RecordRelationship } from "#/ui/model/record-relationships.ts"
import { useModelRuntime } from "#/ui/model/runtime-context.tsx"
import { useCapabilities } from "#/ui/model/use-capabilities.ts"

/** A relationship supplies context and actions; collection rendering stays object-owned. */
export function ObjectRelationshipCollection({
  relationship,
}: {
  readonly relationship: RecordRelationship
}) {
  const total = useQuery(relationship.list({ pageSize: 3 }))
  const capabilities = useCapabilities([
    ...relationship.checks,
    ...relationship.creates.flatMap((entry) => entry.checks),
  ])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const mutate = async (operation: () => Promise<void>) => {
    setError(undefined)
    setPending(true)
    try {
      await operation()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update the relationship."
      )
    } finally {
      setPending(false)
    }
  }
  const hasRoom =
    total.data !== undefined &&
    (relationship.cardinality === "many" || total.data.totalSize === 0)
  const canConnect = !pending && relationship.checks.some(capabilities.can)
  const creates = hasRoom
    ? relationship.creates.filter((entry) =>
        entry.checks.every(capabilities.can)
      )
    : []
  const renderAdd = (records: ReadonlyArray<ClientRecord>) =>
    hasRoom && canConnect && relationship.connect ? (
      <ObjectReferenceSelect
        allowCreate={false}
        id={`${relationship.key}-add`}
        name="relationship"
        appearance="action"
        placeholder={`Add ${relationship.target?.name.toLowerCase() ?? "record"}`}
        typeId={relationship.targetType}
        value=""
        required
        includeHiddenInput={false}
        selectedValues={records.map((record) => record.id)}
        onBlur={() => undefined}
        onValueChange={(id, option) => {
          const typeId =
            option?.presentation?.object.id ?? relationship.target?.id
          if (typeId) void mutate(() => relationship.connect!(id, typeId))
        }}
      />
    ) : null
  const unlink =
    canConnect && relationship.disconnect
      ? (record: ClientRecord) => mutate(() => relationship.disconnect!(record))
      : undefined
  return (
    <div className="flex h-full min-h-0 flex-col">
      {error && (
        <p role="alert" className="border-b px-4 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {relationship.target ? (
        <RelatedObjectCollection
          object={relationship.target}
          relationship={relationship}
          create={creates[0]?.options}
          renderAdd={renderAdd}
          unlink={unlink}
        />
      ) : (
        <RelatedRecordFeed
          relationship={relationship}
          creates={creates}
          renderAdd={renderAdd}
          unlink={unlink}
        />
      )}
    </div>
  )
}

function RelatedObjectCollection({
  object,
  relationship,
  create,
  renderAdd,
  unlink,
}: {
  readonly object: ModelObject
  readonly relationship: RecordRelationship
  readonly create: RecordRelationship["creates"][number]["options"] | undefined
  readonly renderAdd: (records: ReadonlyArray<ClientRecord>) => ReactNode
  readonly unlink: ((record: ClientRecord) => Promise<void>) | undefined
}) {
  const runtime = useModelRuntime()

  const ui = useObjectUi(object)
  return (
    <ObjectCollection
      object={object}
      views={ui?.collection?.views}
      actions={ui?.actions}
      toolbarComponent={ui?.collection?.toolbarComponent}
      recordHref={(id) => objectHref(runtime, object, id)}
      source={{ list: relationship.list, create, renderAdd, unlink }}
    />
  )
}

/** Mixed endpoints use the same cursor chain and summaries, without inventing shared table columns. */
function RelatedRecordFeed({
  relationship,
  creates,
  renderAdd,
  unlink,
}: {
  readonly relationship: RecordRelationship
  readonly creates: RecordRelationship["creates"]
  readonly renderAdd: (records: ReadonlyArray<ClientRecord>) => ReactNode
  readonly unlink: ((record: ClientRecord) => Promise<void>) | undefined
}) {
  const runtime = useModelRuntime()

  const page = useInfiniteQuery(
    modelCollectionQuery(relationship.list, { pageSize: 50 })
  )
  const records = page.data?.pages.flatMap((result) => result.items) ?? []
  const items = records.flatMap((record) => {
    const object = Object.values(runtime.model.objects).find(
      (candidate) => candidate.id === record.objectType
    )
    return object ? [{ object, record }] : []
  })
  return (
    <>
      <div className="flex min-h-10 flex-wrap items-center justify-end gap-2 border-b px-4 py-1">
        <RecordRelatedCreateMenu
          relationships={[{ ...relationship, creates }]}
          totals={new Map([[relationship.key, page.data?.pages[0]?.totalSize]])}
        />
        {renderAdd(records)}
      </div>
      {page.isError && (
        <div
          role="alert"
          className="flex items-center justify-between px-4 py-2 text-xs"
        >
          Could not load related records.
          <Button size="sm" variant="ghost" onClick={() => void page.refetch()}>
            Retry
          </Button>
        </div>
      )}
      <ObjectRecordFeed
        items={items}
        label={relationship.label}
        loading={page.isPending}
        renderActions={(record) =>
          unlink ? (
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="Unlink record"
              onClick={() => void unlink(record)}
            >
              <UnlinkIcon />
            </Button>
          ) : null
        }
      />
      <CollectionPagination
        loaded={records.length}
        totalSize={page.data?.pages[0]?.totalSize ?? 0}
        hasNextPage={page.hasNextPage}
        loading={page.isFetching}
        onNextPage={() => {
          if (!page.isFetching)
            void page.fetchNextPage({ cancelRefetch: false })
        }}
      />
    </>
  )
}
