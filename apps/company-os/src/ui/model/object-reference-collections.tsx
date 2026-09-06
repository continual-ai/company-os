import { useMemo } from "react"

import { useObjectUi } from "./module-ui"
import { ObjectCollection } from "./object-collection"
import type { ObjectCollectionFilter } from "./object-collection-view"
import type { referenceCollections } from "./object-reference-metadata"
import { objectHref } from "./object-routing"

/** References use the same collection; only their fixed context and create defaults differ. */
export function ObjectReferenceCollection({
  relationship,
  recordId,
  recordLabel,
}: {
  readonly relationship: ReturnType<typeof referenceCollections>[number]
  readonly recordId: string
  readonly recordLabel: string
}) {
  const ui = useObjectUi(relationship.object)
  const filters = useMemo<ReadonlyArray<ObjectCollectionFilter>>(
    () => [
      {
        id: relationship.field,
        value: { operator: "equals", values: [recordId] },
      },
    ],
    [relationship.field, recordId]
  )
  const defaults = useMemo(
    () => ({ [relationship.field]: recordId }),
    [relationship.field, recordId]
  )
  const labels = useMemo(
    () => new Map([[recordId, recordLabel]]),
    [recordId, recordLabel]
  )
  return (
    <ObjectCollection
      object={relationship.object}
      fixedFilters={filters}
      createInitialValues={defaults}
      createReferenceLabels={labels}
      views={ui?.collection?.views}
      actions={ui?.actions}
      recordHref={(id) => objectHref(relationship.object, id)}
    />
  )
}
