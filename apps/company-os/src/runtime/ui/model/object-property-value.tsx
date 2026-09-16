import { DateTime } from "@company/ui/date-time"
import { Markdown } from "@company/ui/markdown"
import { Score } from "@company/ui/score"
import type { ReactNode } from "react"

import { AssetPreviews } from "#/runtime/assets/ui/asset-preview.tsx"
import type { AnySchema, PropertyDefinition } from "#/runtime/model/index.ts"
import { unionMember } from "#/runtime/ui/forms/schema-form-values.ts"
import { ObjectChoiceBadge } from "#/runtime/ui/model/object-choice-badge.tsx"
import type { ObjectRecordPresentation } from "#/runtime/ui/model/object-client.ts"
import { ObjectRecordIdentity } from "#/runtime/ui/model/object-record-identity.tsx"
import { objectRecordHref } from "#/runtime/ui/model/object-routing.ts"
import { objectTablePropertySchema } from "#/runtime/ui/model/object-table/object-table-cell-types.ts"
import {
  objectTableValueText,
  type ObjectTableValue,
} from "#/runtime/ui/model/object-table/object-table-config.ts"
import { type ModelUiRuntime } from "#/runtime/ui/model/runtime-context.tsx"

export function objectPropertyValue(
  runtime: ModelUiRuntime,
  property: PropertyDefinition | undefined,
  value: ObjectTableValue | undefined,
  references: ReadonlyMap<string, ObjectRecordPresentation>
): ReactNode {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return <span className="text-muted-foreground/60">Empty</span>
  }
  const schema =
    property === undefined ? undefined : objectTablePropertySchema(property)
  if (schema?.kind === "recordId" && typeof value === "string") {
    const reference = references.get(value)
    return reference === undefined ? (
      value
    ) : (
      <ObjectRecordIdentity
        {...reference}
        className="max-w-full"
        href={objectRecordHref(runtime, reference.object, value)}
      />
    )
  }
  if (schema === undefined) return objectTableValueText(value)
  if (
    schema.kind === "struct" ||
    schema.kind === "union" ||
    (schema.kind === "string" && schema.secret)
  )
    return <StructuredValue schema={schema} value={value} />
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
  return objectTableValueText(value)
}

function StructuredValue({
  schema,
  value,
}: {
  readonly schema: AnySchema
  readonly value: unknown
}): ReactNode {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">Empty</span>
  if (schema.kind === "string" && schema.secret)
    return typeof value === "object" &&
      "hint" in value &&
      typeof value.hint === "string"
      ? value.hint
      : "Set"
  if (schema.kind === "optional")
    return <StructuredValue schema={schema.value} value={value} />
  if (schema.kind === "union") {
    const member = unionMember(schema, value)
    if (member) return <StructuredValue schema={member} value={value} />
  }
  if (
    schema.kind === "struct" &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return (
      <dl className="space-y-2 text-sm">
        {Object.entries(schema.properties).map(([key, field]) => (
          <div key={key}>
            <dt className="text-muted-foreground">{field.label ?? key}</dt>
            <dd className="break-words">
              <StructuredValue schema={field} value={Reflect.get(value, key)} />
            </dd>
          </div>
        ))}
      </dl>
    )
  }
  if (schema.kind === "array" && Array.isArray(value)) {
    return (
      <ul className="list-inside list-disc">
        {value.map((item, index) => (
          <li key={index}>
            <StructuredValue schema={schema.items} value={item} />
          </li>
        ))}
      </ul>
    )
  }
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "string" || typeof value === "number")
    return String(value)
  return JSON.stringify(value)
}
