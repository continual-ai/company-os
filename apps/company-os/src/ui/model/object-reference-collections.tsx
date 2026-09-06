import { Button } from "@company/ui/components/button"
import { Link } from "@tanstack/react-router"
import { useState } from "react"

import { recordLabel } from "./object-client"
import type { ObjectCollectionFilter } from "./object-collection-view"
import type { referenceCollections } from "./object-reference-metadata"
import { objectHref } from "./object-routing"
import { useObjectCollection } from "./use-object-collection"

const noSort = [] as const

export function ObjectReferenceCollection({
  relationship,
  recordId,
}: {
  readonly relationship: ReturnType<typeof referenceCollections>[number]
  readonly recordId: string
}) {
  const [filters] = useState<ReadonlyArray<ObjectCollectionFilter>>(() => [
    {
      id: relationship.field,
      value: { operator: "equals", values: [recordId] },
    },
  ])
  const collection = useObjectCollection(relationship.object, filters, noSort)
  return (
    <section className="mx-auto grid w-full max-w-6xl gap-4 p-5">
      {collection.error ? (
        <p role="alert" className="text-sm text-destructive">
          {collection.error}
        </p>
      ) : null}
      <ul className="divide-y rounded-md border bg-background">
        {collection.records.map((record) => (
          <li key={record.id}>
            <Link
              to={objectHref(relationship.object, record.id)}
              className="block px-4 py-3 text-sm hover:bg-muted"
            >
              {recordLabel(relationship.object, record)}
            </Link>
          </li>
        ))}
        {collection.records.length === 0 && (
          <li className="p-4 text-sm text-muted-foreground">
            {collection.loading ? "Loading…" : "No related records."}
          </li>
        )}
      </ul>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {collection.totalSize} records
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!collection.hasPreviousPage || collection.loading}
            onClick={collection.previousPage}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={!collection.hasNextPage || collection.loading}
            onClick={collection.nextPage}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  )
}
