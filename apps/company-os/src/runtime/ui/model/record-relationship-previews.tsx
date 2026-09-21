import { Button } from "@company/ui/button"
import { PageSectionHeader } from "@company/ui/page"

import type { Page } from "#/runtime/model/definition/request.ts"
import { formatTotalSize } from "#/runtime/ui/model/format-total-size.ts"
import { ObjectRecordSummary } from "#/runtime/ui/model/object-record-summary.tsx"
import { useRecordReferences } from "#/runtime/ui/model/object-references.ts"
import { objectHref } from "#/runtime/ui/model/object-routing.ts"
import { RecordRelatedCreateMenu } from "#/runtime/ui/model/record-related-create-menu.tsx"
import type { recordRelationshipPreviews } from "#/runtime/ui/model/record-relationship-preview-data.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

export function RelationshipCount({
  count,
}: {
  readonly count:
    | Pick<Page<unknown>, "totalSize" | "totalSizeExact">
    | undefined
}) {
  return count === undefined ? null : (
    <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] leading-none font-medium text-muted-foreground tabular-nums">
      {formatTotalSize(count)}
    </span>
  )
}

export function RecordRelationshipPreviews({
  previews,
  onSelect,
}: {
  readonly previews: ReturnType<typeof recordRelationshipPreviews>
  readonly onSelect: (key: string) => void
}) {
  const runtime = useModelRuntime()

  const references = useRecordReferences(
    previews.flatMap((preview) => preview.items)
  )
  return (
    <div className="space-y-6">
      {previews.map((preview) => (
        <section
          key={preview.key}
          aria-label={`Recent ${preview.label.toLowerCase()}`}
        >
          <PageSectionHeader className="flex-wrap">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              {preview.label}
              <RelationshipCount
                count={preview.pending ? undefined : preview}
              />
            </h2>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelect(preview.key)}
              >
                View all
              </Button>
              <RecordRelatedCreateMenu
                compact
                relationships={[preview.relationship]}
              />
            </div>
          </PageSectionHeader>
          {preview.pending ? (
            <p className="py-2 text-xs text-muted-foreground">Loading…</p>
          ) : preview.items.length === 0 ? (
            <p className="py-1 text-xs text-muted-foreground">
              No {preview.label.toLowerCase()} yet.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {preview.items.map(({ object: target, record }) => (
                <li
                  key={record.id}
                  className="flex min-h-10 items-center px-3 py-2 hover:bg-muted/30"
                >
                  <ObjectRecordSummary
                    object={target}
                    record={record}
                    author={references.records.get(
                      typeof record.createdBy === "string"
                        ? record.createdBy
                        : ""
                    )}
                    href={objectHref(runtime, target, record.id)}
                    variant="preview"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
