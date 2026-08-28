/* oxlint-disable anti-slop/no-runtime-typeof -- ClientRecord and ObjectTableValue are decoded API representations with a closed value union. */
import { Badge } from "@company/ui/components/badge"
import { Separator } from "@company/ui/components/separator"
import type { ReactNode } from "react"

import {
  modelObjectProperty,
  parentName,
  tableRecord,
  type ClientRecord,
  type ModelObject,
} from "./object-client"
import { objectTablePropertySchema } from "./object-table/object-table-cell-types"
import type { ObjectTableValue } from "./object-table/object-table-config"
import { objectTableValueText } from "./object-table/object-table-config"
import { RecordIdentifier } from "./record-identifier"

function displayValue(
  object: ModelObject,
  propertyId: string,
  value: ObjectTableValue | undefined,
  referenceLabels: ReadonlyMap<string, string>
): ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground/60">Empty</span>
  }
  if (propertyId === "parent" && typeof value === "string") {
    return referenceLabels.get(value) ?? value
  }
  const property = modelObjectProperty(object, propertyId)
  if (property === undefined) return objectTableValueText(value)
  const schema = objectTablePropertySchema(property)
  if (schema.kind === "recordId" && typeof value === "string") {
    return referenceLabels.get(value) ?? value
  }
  if (schema.kind === "enum" && typeof value === "string") {
    const choices =
      schema.options ??
      schema.values.map((option) => ({ label: option, value: option }))
    const label =
      choices.find((choice) => choice.value === value)?.label ?? value
    return <Badge variant="secondary">{label}</Badge>
  }
  if (
    schema.kind === "string" &&
    schema.format === "url" &&
    typeof value === "string"
  ) {
    return (
      <a
        className="text-interactive hover:underline"
        href={value}
        rel="noreferrer"
        target="_blank"
      >
        {value}
      </a>
    )
  }
  if (
    schema.kind === "string" &&
    schema.format === "email" &&
    typeof value === "string"
  ) {
    return (
      <a className="text-interactive hover:underline" href={`mailto:${value}`}>
        {value}
      </a>
    )
  }
  if (
    schema.kind === "string" &&
    schema.format === "phone" &&
    typeof value === "string"
  ) {
    return (
      <a className="text-interactive hover:underline" href={`tel:${value}`}>
        {value}
      </a>
    )
  }
  return objectTableValueText(value)
}

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
            <dd className="min-w-0 text-sm wrap-break-word">
              {displayValue(
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
