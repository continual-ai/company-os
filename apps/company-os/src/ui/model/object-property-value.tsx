import { Badge } from "@company/ui/components/badge"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

import { AssetPreviews } from "@/modules/assets/asset/ui/asset-preview"

import {
  recordObjectTypes,
  modelObjectProperty,
  type ModelObject,
} from "./object-client"
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
  referenceLabels: ReadonlyMap<string, string>
): ReactNode {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return <span className="text-muted-foreground/60">Empty</span>
  }
  if (propertyId === "parent" && typeof value === "string") {
    return referenceLabels.get(value) ?? value
  }
  const property = modelObjectProperty(object, propertyId)
  if (property === undefined) return objectTableValueText(value)
  const schema = objectTablePropertySchema(property)
  const fileSchema =
    schema.kind === "array" ? objectTablePropertySchema(schema.items) : schema
  if (
    fileSchema.kind === "file" ||
    fileSchema.kind === "image" ||
    fileSchema.kind === "media"
  ) {
    const values = Array.isArray(value) ? value : [value]
    const references = values.flatMap((item) => {
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
      <AssetPreviews
        references={references}
        image={fileSchema.kind === "image"}
      />
    )
  }
  if (schema.kind === "recordId" && typeof value === "string") {
    const target = recordObjectTypes(schema.typeId)
    const label = referenceLabels.get(value) ?? value
    return target.length === 1 ? (
      <Link
        className="text-interactive hover:underline"
        to={objectHref(target[0]!, value)}
      >
        {label}
      </Link>
    ) : (
      label
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
