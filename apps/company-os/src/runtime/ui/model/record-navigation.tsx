import { useQuery } from "@tanstack/react-query"
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react"

import type { ListRequest } from "#/runtime/model/index.ts"
import type { CollectionPages } from "#/runtime/ui/model/collection-pages.tsx"
import {
  clientFor,
  type ModelObject,
} from "#/runtime/ui/model/object-client.ts"
import { objectHref } from "#/runtime/ui/model/object-routing.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

interface CollectionSource {
  readonly objectId: string
  readonly request: ListRequest
  readonly href: string
}
interface RecordOrigin extends CollectionSource {
  readonly recordId: string
  readonly position: number
  readonly total: number
}

export interface RecordNavigation {
  readonly position: number
  readonly total: number
  readonly hasPrevious: boolean
  readonly hasNext: boolean
  readonly loading: boolean
  readonly error?: string | undefined
  readonly move: (direction: "previous" | "next") => string | undefined
}

const CollectionNavigationContext = createContext<RecordOrigin | undefined>(
  undefined
)
const RememberCollectionContext = createContext<
  ((source: RecordOrigin) => void) | undefined
>(undefined)

/** Navigation remembers the opened record, while Query remains the owner of loaded pages. */
export function CollectionNavigationProvider({
  children,
}: {
  children: ReactNode
}) {
  const [origin, remember] = useState<RecordOrigin>()
  return (
    <RememberCollectionContext.Provider value={remember}>
      <CollectionNavigationContext.Provider value={origin}>
        {children}
      </CollectionNavigationContext.Provider>
    </RememberCollectionContext.Provider>
  )
}

/** Capture only ordinary in-tab record opens; modified clicks keep their native link behavior. */
export function useCaptureCollectionNavigation(
  source: CollectionSource | undefined,
  pages: CollectionPages
) {
  const remember = useContext(RememberCollectionContext)
  return useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (
        !source ||
        !remember ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[data-record-id]")
          : null
      if (
        !link ||
        link.dataset.objectId !== source.objectId ||
        link.target === "_blank"
      )
        return
      const recordId = link.dataset.recordId!
      const position =
        pages.viewport?.indices.get(recordId) ??
        pages.records.findIndex((record) => record.id === recordId)
      if (position >= 0)
        remember({ ...source, recordId, position, total: pages.totalSize })
    },
    [source, pages, remember]
  )
}

/** Fetch just the two neighbors, even when the collection was opened at a distant offset. */
export function useRecordNavigation(
  object: ModelObject,
  recordId: string,
  enabled: boolean
) {
  const runtime = useModelRuntime()
  const origin = useContext(CollectionNavigationContext)
  const remember = useContext(RememberCollectionContext)
  const source = origin?.objectId === object.id ? origin : undefined
  const active = enabled && source?.recordId === recordId
  const client = useMemo(() => clientFor(runtime, object), [runtime, object])
  const offset = Math.max(0, (source?.position ?? 0) - 1)
  const nearby = useQuery({
    ...client.list.queryOptions({
      ...source?.request,
      pageSize: 3,
      pageOffset: offset,
    }),
    enabled: active,
  })
  const navigation = useMemo<RecordNavigation | undefined>(() => {
    const records = nearby.data?.items ?? []
    const index = records.findIndex((record) => record.id === recordId)
    return !active || !source
      ? undefined
      : {
          position: index < 0 ? source.position + 1 : offset + index + 1,
          total: nearby.data?.totalSize ?? source.total,
          hasPrevious: index > 0,
          hasNext: index >= 0 && index + 1 < records.length,
          loading: nearby.isFetching,
          error: nearby.isError
            ? "Could not load neighboring records."
            : undefined,
          move: (direction) => {
            if (index < 0) return undefined
            const nextIndex = index + (direction === "previous" ? -1 : 1)
            const next = records[nextIndex]
            if (!next) return undefined
            remember?.({
              ...source,
              recordId: next.id,
              position: offset + nextIndex,
            })
            return objectHref(runtime, object, next.id)
          },
        }
  }, [
    active,
    source,
    nearby.data,
    nearby.isFetching,
    nearby.isError,
    recordId,
    offset,
    remember,
    runtime,
    object,
  ])
  return {
    navigation,
    collectionHref: source?.href ?? objectHref(runtime, object),
  }
}
