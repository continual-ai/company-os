import { DateTime } from "@company/ui/date-time"
import { Markdown } from "@company/ui/markdown"
import { Score } from "@company/ui/score"
import type { ReactNode } from "react"

import { AssetPreviews } from "#/runtime/assets/ui/asset-preview.tsx"
import type { AnySchema } from "#/runtime/model/index.ts"
import { unionMember } from "#/runtime/ui/forms/schema-form-values.ts"
import { EmptyFieldValue } from "#/runtime/ui/model/empty-field-value.tsx"
import { ObjectChoiceBadge } from "#/runtime/ui/model/object-choice-badge.tsx"
import { objectTablePropertySchema } from "#/runtime/ui/model/object-table/object-table-cell-types.ts"
import type { ObjectTableRecordResolver } from "#/runtime/ui/model/object-table/object-table-config.ts"
import {
  objectTableValueText,
  type ObjectTableValue,
} from "#/runtime/ui/model/object-table/object-table-config.ts"
import { RecordLinkValue } from "#/runtime/ui/model/record-link-value.tsx"

export function objectPropertyValue(
  property: AnySchema | undefined,
  value: ObjectTableValue | undefined,
  resolveRecord?: ObjectTableRecordResolver
): ReactNode {
  const schema =
    property === undefined ? undefined : objectTablePropertySchema(property)
  if (schema?.kind === "json" && value !== undefined)
    return (
      <pre className="whitespace-pre-wrap wrap-anywhere text-sm">
        {JSON.stringify(value, null, 2)}
      </pre>
    )
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return <EmptyFieldValue />
  }
  if (schema?.kind === "recordId" && typeof value === "string") {
    return <RecordLinkValue value={value} resolveRecord={resolveRecord} />
  }
  if (schema === undefined) return objectTableValueText(value)
  if (schema.kind === "string" && schema.secret)
    return typeof value === "object" &&
      "hint" in value &&
      typeof value.hint === "string"
      ? value.hint
      : "Set"
  if (schema.kind === "union") {
    const member = unionMember(schema, value)
    return member ? (
      objectPropertyValue(member, value, resolveRecord)
    ) : (
      <span className="text-muted-foreground">Unavailable</span>
    )
  }
  if (
    schema.kind === "struct" &&
    typeof value === "object" &&
    !Array.isArray(value)
  )
    return (
      <dl className="@container min-w-0 divide-y rounded-lg border bg-background text-sm whitespace-normal">
        {Object.entries(schema.properties).map(([key, field]) => (
          <div
            key={key}
            className="grid min-w-0 gap-1 px-3 py-2.5 @sm:grid-cols-[minmax(8rem,1fr)_minmax(0,2fr)] @sm:gap-4"
          >
            <dt className="text-xs leading-5 text-muted-foreground">
              {field.label ?? key}
            </dt>
            <dd className="min-w-0 text-sm leading-5 wrap-anywhere">
              {objectPropertyValue(
                field,
                Reflect.get(value, key),
                resolveRecord
              )}
            </dd>
          </div>
        ))}
      </dl>
    )
  if (
    schema.kind === "string" &&
    schema.format === "markdown" &&
    typeof value === "string"
  ) {
    return <Markdown>{value}</Markdown>
  }
  if (
    schema.kind === "number" &&
    schema.format === "score" &&
    typeof value === "number"
  ) {
    return (
      <Score
        value={value}
        min={schema.minimum}
        max={schema.maximum}
        label={property?.label ?? "Score"}
      />
    )
  }
  const fileSchema =
    schema.kind === "array" ? objectTablePropertySchema(schema.items) : schema
  if (
    fileSchema.kind === "file" ||
    fileSchema.kind === "image" ||
    fileSchema.kind === "media"
  ) {
    const values = Array.isArray(value) ? value : [value]
    const assets = values.flatMap((item) => {
      if (
        typeof item !== "object" ||
        item === null ||
        !("assetId" in item) ||
        typeof item.assetId !== "string"
      )
        return []
      return [
        {
          assetId: item.assetId,
          alt: "alt" in item && typeof item.alt === "string" ? item.alt : "",
        },
      ]
    })
    return (
      <AssetPreviews references={assets} image={fileSchema.kind === "image"} />
    )
  }
  if (
    schema.kind === "string" &&
    (schema.format === "date" || schema.format === "timestamp") &&
    typeof value === "string"
  ) {
    return (
      <DateTime
        value={value}
        kind={schema.format === "date" ? "date" : "datetime"}
      />
    )
  }
  if (schema.kind === "enum" && typeof value === "string") {
    const choices =
      schema.options ??
      schema.values.map((option) => ({ label: option, value: option }))
    const label =
      choices.find((choice) => choice.value === value)?.label ?? value
    return (
      <ObjectChoiceBadge
        choice={
          choices.find((choice) => choice.value === value) ?? { label, value }
        }
      />
    )
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
  if (schema.kind === "array" && Array.isArray(value))
    return (
      <ul className="space-y-2">
        {value.map((item, index) => (
          <li key={index} className="min-w-0">
            {objectPropertyValue(schema.items, item, resolveRecord)}
          </li>
        ))}
      </ul>
    )
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return objectTableValueText(value)
}
