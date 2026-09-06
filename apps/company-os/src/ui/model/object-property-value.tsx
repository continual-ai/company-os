import { Badge } from "@company/ui/components/badge"
import type { ReactNode } from "react"

import { AssetPreviews } from "@/modules/assets/asset/ui/asset-preview"

import {
  modelObjectProperty,
  type ModelObject,
  type ObjectRecordPresentation,
} from "./object-client"
import { ObjectRecordIdentity } from "./object-record-identity"
import { objectHref } from "./object-routing"
import { objectTablePropertySchema } from "./object-table/object-table-cell-types"
import {
  objectTableValueText,
  type ObjectTableValue,
} from "./object-table/object-table-config"

export function objectPropertyValue(
  object: ModelObject,
  propertyId: string,
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
  const property = modelObjectProperty(object, propertyId)
  const schema =
    property === undefined ? undefined : objectTablePropertySchema(property)
  if (
    (propertyId === "parent" || schema?.kind === "recordId") &&
    typeof value === "string"
  ) {
    const reference = references.get(value)
    return reference === undefined ? (
      value
    ) : (
      <ObjectRecordIdentity
        {...reference}
        href={objectHref(reference.object, value)}
      />
    )
  }
  if (schema === undefined) return objectTableValueText(value)
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
