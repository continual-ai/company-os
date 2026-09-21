import { linkPreview } from "#/runtime/model/record-links.ts"
import { EmptyFieldValue } from "#/runtime/ui/model/empty-field-value.tsx"
import { formatTotalSize } from "#/runtime/ui/model/format-total-size.ts"
import type { ObjectRecordPresentation } from "#/runtime/ui/model/object-client.ts"
import { ObjectRecordIdentity } from "#/runtime/ui/model/object-record-identity.tsx"
import { objectRecordHref } from "#/runtime/ui/model/object-routing.ts"
import type { ObjectTableImageResolver } from "#/runtime/ui/model/object-table/object-table-config.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

/** Single links and collections share identities; cardinality only changes the number displayed. */
export function RecordLinkValue({
  value,
  resolveRecord,
  resolveImageSrc,
}: {
  readonly value: Parameters<typeof linkPreview>[0]
  readonly resolveImageSrc?: ObjectTableImageResolver | undefined
  readonly resolveRecord?:
    | ((id: string) => ObjectRecordPresentation | undefined)
    | undefined
}) {
  const runtime = useModelRuntime()
  const { ids, totalSize, totalSizeExact } = linkPreview(value)
  if (ids.length === 0 && totalSize === 0 && totalSizeExact)
    return <EmptyFieldValue />
  return (
    <span className="flex min-w-0 items-center gap-1.5 overflow-hidden">
      {ids.map((id) => {
        const related = resolveRecord?.(id)
        return related ? (
          <ObjectRecordIdentity
            key={id}
            {...related}
            resolveImageSrc={resolveImageSrc}
            className="min-w-0 max-w-full shrink truncate"
            href={objectRecordHref(runtime, related.object, id)}
          />
        ) : (
          <span key={id} className="truncate text-muted-foreground">
            {id}
          </span>
        )
      })}
      {totalSize > ids.length && (
        <span className="shrink-0 text-muted-foreground">
          +
          {formatTotalSize({
            totalSize: totalSize - ids.length,
            totalSizeExact,
          })}
        </span>
      )}
    </span>
  )
}
