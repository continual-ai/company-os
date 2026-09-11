import type { ObjectRecordPresentation } from "#/runtime/ui/model/object-client.ts"
import { ObjectRecordIdentity } from "#/runtime/ui/model/object-record-identity.tsx"
import { objectRecordHref } from "#/runtime/ui/model/object-routing.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

/** Single links and collections share identities; cardinality only changes the number displayed. */
export function RecordLinkValue({
  ids,
  totalSize,
  resolveRecord,
}: {
  readonly ids: ReadonlyArray<string>
  readonly totalSize: number
  readonly resolveRecord?:
    | ((id: string) => ObjectRecordPresentation | undefined)
    | undefined
}) {
  const runtime = useModelRuntime()
  return (
    <span className="flex min-w-0 items-center gap-1.5 overflow-hidden">
      {ids.map((id) => {
        const related = resolveRecord?.(id)
        return related ? (
          <ObjectRecordIdentity
            key={id}
            {...related}
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
          +{totalSize - ids.length}
        </span>
      )}
    </span>
  )
}
