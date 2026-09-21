import { Button } from "@company/ui/button"
import { useInfiniteQuery } from "@tanstack/react-query"
import { UnlinkIcon } from "lucide-react"
import { useState, type ReactNode } from "react"

import type { ObjectType } from "#/runtime/model/definition/object.ts"
import { CollectionPagination } from "#/runtime/ui/model/collection-pagination.tsx"
import { useObjectUi } from "#/runtime/ui/model/module-ui.tsx"
import { type ClientRecord } from "#/runtime/ui/model/object-client.ts"
import { ObjectCollection } from "#/runtime/ui/model/object-collection.tsx"
import { ObjectRecordFeed } from "#/runtime/ui/model/object-record-feed.tsx"
import { objectHref } from "#/runtime/ui/model/object-routing.ts"
import { type RecordLinkView } from "#/runtime/ui/model/record-link-views.ts"
import { RecordRelatedCreateMenu } from "#/runtime/ui/model/record-related-create-menu.tsx"
import { RecordSelect } from "#/runtime/ui/model/record-select.tsx"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

/** A link supplies context and actions; collection rendering stays object-owned. */
export function RecordLinkCollection({
  link,
}: {
  readonly link: RecordLinkView
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const mutate = async (operation: () => Promise<void>) => {
    setError(undefined)
    setPending(true)
    try {
      await operation()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update the link."
      )
    } finally {
      setPending(false)
    }
  }
  const canLink = !pending
  const renderLink = (records: ReadonlyArray<ClientRecord>) =>
    canLink && link.link ? (
      <RecordSelect
        allowCreate={false}
        id={`${link.key}-link`}
        name="link"
        appearance="action"
        placeholder={`Link ${link.target?.name.toLowerCase() ?? "record"}`}
        typeId={link.targetType}
        value=""
        required
        includeHiddenInput={false}
        selectedValues={records.map((record) => record.id)}
        onBlur={() => undefined}
        onValueChange={(id) => {
          void mutate(() => link.link!(id))
        }}
      />
    ) : null
  const unlink =
    canLink && link.unlink
      ? (record: ClientRecord) => mutate(() => link.unlink!(record))
      : undefined
  return (
    <div className="flex h-full min-h-0 flex-col">
      {error && (
        <p
          role="alert"
          className="border-b px-page-gutter py-2 text-xs text-destructive"
        >
          {error}
        </p>
      )}
      {link.target ? (
        <RelatedObjectCollection
          object={link.target}
          link={link}
          create={link.creates[0]?.options}
          renderLink={renderLink}
          unlink={unlink}
        />
      ) : (
        <RelatedRecordFeed
          link={link}
          renderLink={renderLink}
          unlink={unlink}
        />
      )}
    </div>
  )
}

function RelatedObjectCollection({
  object,
  link,
  create,
  renderLink,
  unlink,
}: {
  readonly object: ObjectType
  readonly link: RecordLinkView
  readonly create: RecordLinkView["creates"][number]["options"] | undefined
  readonly renderLink: (records: ReadonlyArray<ClientRecord>) => ReactNode
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
      source={{ list: link.list, create, renderLink, unlink }}
    />
  )
}

/** Mixed endpoints use the same cursor chain and summaries, without inventing shared table columns. */
function RelatedRecordFeed({
  link,
  renderLink,
  unlink,
}: {
  readonly link: RecordLinkView
  readonly renderLink: (records: ReadonlyArray<ClientRecord>) => ReactNode
  readonly unlink: ((record: ClientRecord) => Promise<void>) | undefined
}) {
  const runtime = useModelRuntime()

  const page = useInfiniteQuery(
    link.list.infiniteQueryOptions({ pageSize: 50 })
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
      <div className="flex min-h-10 flex-wrap items-center justify-end gap-2 border-b px-page-gutter py-1">
        <RecordRelatedCreateMenu links={[link]} />
        {renderLink(records)}
      </div>
      {page.isError && (
        <div
          role="alert"
          className="flex items-center justify-between px-page-gutter py-2 text-xs"
        >
          Could not load related records.
          <Button size="sm" variant="ghost" onClick={() => void page.refetch()}>
            Retry
          </Button>
        </div>
      )}
      <ObjectRecordFeed
        items={items}
        label={link.label}
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
        totalSizeExact={page.data?.pages[0]?.totalSizeExact ?? true}
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
