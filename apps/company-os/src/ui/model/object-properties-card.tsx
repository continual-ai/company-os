import { Separator } from "@company/ui/components/separator"

import {
  parentName,
  tableRecord,
  type ClientRecord,
  type ModelObject,
} from "./object-client"
import { objectPropertyValue } from "./object-property-value"
import { RecordIdentifier } from "./record-identifier"

export function ObjectPropertiesCard({
  object,
  record,
  referenceLabels,
}: {
  readonly object: ModelObject
  readonly record: ClientRecord
  readonly referenceLabels: ReadonlyMap<string, string>
}) {
  const projected = tableRecord(object, record)
  const properties = [
    ...(object.parent.kind === "root"
      ? []
      : [["parent", { label: parentName(object) }] as const]),
    ...Object.entries(object.properties),
  ]

  return (
    <section className="overflow-hidden border bg-background">
      <div className="px-4 py-3">
        <h2 className="text-sm font-medium">Properties</h2>
      </div>
      <Separator />
      <dl>
        {properties.map(([propertyId, property]) => (
          <div
            key={propertyId}
            className="grid gap-1 border-b px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4"
          >
            <dt className="text-xs text-muted-foreground">
              {property.label ?? propertyId}
            </dt>
            <dd className="min-w-0 text-sm wrap-break-word whitespace-pre-wrap">
              {objectPropertyValue(
                object,
                propertyId,
                projected[propertyId],
                referenceLabels
              )}
            </dd>
          </div>
        ))}
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
          <dt className="text-xs text-muted-foreground">Record ID</dt>
          <dd className="min-w-0 text-sm">
            <RecordIdentifier value={record.id} />
          </dd>
        </div>
      </dl>
    </section>
  )
}
