import { Model } from "@company/model"
import {
  modelObjectLinkTraversals,
  type ModelLinkTraversal,
} from "@company/runtime"
import { Button } from "@company/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@company/ui/components/empty"
import {
  ChevronDownIcon,
  ChevronRightIcon,
  LinkIcon,
  UnlinkIcon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { formErrorFromCause } from "@/ui/forms/form-errors"

import {
  describeReferences,
  type DynamicLinkListInput,
  linkClientFor,
  recordObjectTypes,
  type ClientRecord,
  type ModelObject,
  type RelatedRecord,
} from "./object-client"
import { ObjectRelationshipCollection } from "./object-relationship-collection"
import { ObjectRelationshipForm } from "./object-relationship-form"

const RELATIONSHIP_PAGE_SIZE = 20

function errorMessage(cause: unknown, fallback: string): string {
  const errors = formErrorFromCause(cause, fallback)
  return (
    errors.form?.[0]?.message ??
    Object.values(errors.fields)[0]?.[0]?.message ??
    fallback
  )
}

function Relationship({
  canUpdate,
  collapsible = true,
  object,
  onTotalSizeChange,
  record,
  traversal,
}: {
  readonly canUpdate: boolean
  readonly collapsible?: boolean | undefined
  readonly object: ModelObject
  readonly onTotalSizeChange?:
    | ((traversalKey: string, totalSize: number) => void)
    | undefined
  readonly record: ClientRecord
  readonly traversal: ModelLinkTraversal
}) {
  const client = useMemo(
    () => linkClientFor(object, traversal),
    [object, traversal]
  )
  const [items, setItems] = useState<ReadonlyArray<RelatedRecord>>([])
  const [expanded, setExpanded] = useState(!collapsible)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string>()
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string>()
  const link = canUpdate ? client.link : undefined
  const unlink = canUpdate ? client.unlink : undefined

  const load = useCallback(
    async (pageToken?: string) => {
      setLoading(true)
      setLoadError(undefined)
      try {
        const request: DynamicLinkListInput =
          pageToken === undefined
            ? { id: record.id, pageSize: RELATIONSHIP_PAGE_SIZE }
            : {
                id: record.id,
                pageSize: RELATIONSHIP_PAGE_SIZE,
                pageToken,
              }
        const page = await client.list(request)
        const described = await describeReferences(page.items)
        setItems((current) =>
          pageToken === undefined ? described : [...current, ...described]
        )
        setNextPageToken(page.nextPageToken)
        onTotalSizeChange?.(traversal.traversal.key, page.totalSize)
      } catch (cause) {
        setLoadError(
          errorMessage(
            cause,
            `${traversal.traversal.label} could not be loaded.`
          )
        )
      } finally {
        setLoading(false)
      }
    },
    [client, onTotalSizeChange, record.id, traversal.traversal]
  )

  useEffect(() => {
    if (!expanded) return
    void load()
  }, [expanded, load])

  const canAdd =
    link !== undefined &&
    !loading &&
    (traversal.traversal.cardinality === "many" || items.length === 0)

  return (
    <section
      className={
        collapsible
          ? "grid gap-3 border-t pt-4"
          : "overflow-hidden border bg-background"
      }
    >
      {collapsible ? (
        <Button
          type="button"
          variant="ghost"
          className="h-auto justify-start gap-2 px-0 text-left"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          <span>
            <span className="block text-sm font-medium">
              {traversal.traversal.label}
            </span>
            {traversal.traversal.description === undefined ? null : (
              <span className="block text-xs font-normal text-muted-foreground">
                {traversal.traversal.description}
              </span>
            )}
          </span>
        </Button>
      ) : (
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-medium">{traversal.traversal.label}</h2>
          {traversal.traversal.description === undefined ? null : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {traversal.traversal.description}
            </p>
          )}
        </div>
      )}

      {expanded ? (
        <div className={collapsible ? "grid gap-3" : "grid gap-4 p-4"}>
          {loadError === undefined ? null : (
            <div className="flex items-center justify-between gap-3 text-xs text-destructive">
              <span>{loadError}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void load()}
              >
                Retry
              </Button>
            </div>
          )}

          {items.length === 0 && loading ? (
            <output className="grid min-h-56 place-items-center border text-xs text-muted-foreground">
              Loading {traversal.traversal.label.toLowerCase()}…
            </output>
          ) : items.length === 0 ? (
            <Empty className="min-h-56 border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <LinkIcon />
                </EmptyMedia>
                <EmptyTitle>
                  No {traversal.traversal.label.toLowerCase()} yet
                </EmptyTitle>
                <EmptyDescription>
                  Connect a record to make this relationship visible here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-1">
              {items.map((item) => {
                const relatedObject = Object.values(Model.objects).find(
                  ({ id }) => id === item.objectType
                )
                const href =
                  relatedObject === undefined
                    ? undefined
                    : `/${relatedObject.collection}/${item.id}`
                return (
                  <div
                    key={`${item.objectType}:${item.id}`}
                    className="flex min-h-10 items-center justify-between gap-3 border px-3 text-sm"
                  >
                    {href === undefined ? (
                      <span className="min-w-0 truncate">{item.label}</span>
                    ) : (
                      <a
                        className="min-w-0 truncate font-medium hover:underline"
                        href={href}
                      >
                        {item.label}
                      </a>
                    )}
                    {unlink === undefined ? null : (
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        disabled={removing === item.id}
                        aria-label={`Unlink ${item.label}`}
                        onClick={() => {
                          setRemoving(item.id)
                          setLoadError(undefined)
                          void unlink({ id: record.id, target: item.id })
                            .then(() => load())
                            .catch((cause: unknown) =>
                              setLoadError(
                                errorMessage(
                                  cause,
                                  `${traversal.traversal.label} could not be unlinked.`
                                )
                              )
                            )
                            .finally(() => setRemoving(undefined))
                        }}
                      >
                        <UnlinkIcon />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {nextPageToken === null ? null : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => void load(nextPageToken)}
            >
              {loading ? "Loading…" : "Load more"}
            </Button>
          )}

          {canAdd && link !== undefined ? (
            <ObjectRelationshipForm
              link={link}
              recordId={record.id}
              traversal={traversal}
              onLinked={load}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export function ObjectRelationshipPanel({
  canUpdate,
  object,
  onTotalSizeChange,
  record,
  traversal,
}: {
  readonly canUpdate: boolean
  readonly object: ModelObject
  readonly onTotalSizeChange?:
    | ((traversalKey: string, totalSize: number) => void)
    | undefined
  readonly record: ClientRecord
  readonly traversal: ModelLinkTraversal
}) {
  const targetObjects = recordObjectTypes(traversal.target.from.typeId)
  const targetObject = targetObjects.length === 1 ? targetObjects[0] : undefined
  if (targetObject !== undefined) {
    return (
      <ObjectRelationshipCollection
        canUpdate={canUpdate}
        object={object}
        onTotalSizeChange={onTotalSizeChange}
        record={record}
        targetObject={targetObject}
        traversal={traversal}
      />
    )
  }
  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-5">
      <Relationship
        canUpdate={canUpdate}
        collapsible={false}
        object={object}
        onTotalSizeChange={onTotalSizeChange}
        record={record}
        traversal={traversal}
      />
    </div>
  )
}

export function ObjectRelationships({
  canUpdate,
  object,
  record,
}: {
  readonly canUpdate: boolean
  readonly object: ModelObject
  readonly record: ClientRecord
}) {
  const traversals = modelObjectLinkTraversals(Model, object)
  if (traversals.length === 0) return null
  return (
    <div className="grid gap-4">
      {traversals.map((traversal) => (
        <Relationship
          key={traversal.traversal.key}
          canUpdate={canUpdate}
          object={object}
          record={record}
          traversal={traversal}
        />
      ))}
    </div>
  )
}
