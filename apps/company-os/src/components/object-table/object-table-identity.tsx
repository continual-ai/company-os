import { Badge } from "@acme/ui/components/badge"
import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from "@acme/ui/components/preview-card"
import type { ObjectType } from "@continual/runtime"
import { BoxIcon, Building2Icon, UserRoundIcon } from "lucide-react"

import { objectTablePropertySchema } from "./object-table-cell-types"
import {
  objectTableImageValue,
  objectTableValueText,
  type ObjectTableImageResolver,
  type ObjectTableRecord,
  type ObjectTableValue,
} from "./object-table-config"

interface ObjectTableIdentityProps {
  object: ObjectType
  record: ObjectTableRecord
  resolveImageSrc?: ObjectTableImageResolver | undefined
}

function displayText(value: ObjectTableValue | undefined): string {
  if (value === null || value === undefined || value === "") return ""
  if (Array.isArray(value)) return value.join(", ")
  if (value === true) return "Yes"
  if (value === false) return "No"
  return objectTableImageValue(value) === null
    ? objectTableValueText(value)
    : ""
}

function displayImage(
  value: ObjectTableValue | undefined,
  resolveImageSrc: ObjectTableImageResolver | undefined
): string {
  const image = objectTableImageValue(value)
  return image === null ? "" : (resolveImageSrc?.(image) ?? "")
}

function displayStatus(object: ObjectType, record: ObjectTableRecord) {
  const propertyId = object.display.status
  if (propertyId === undefined) return ""

  const value = displayText(record[propertyId])
  const property = object.properties[propertyId]
  if (value.length === 0 || property === undefined) return value

  const schema = objectTablePropertySchema(property)
  if (schema.kind !== "enum") return value

  const choices =
    schema.options ??
    schema.values.map((option) => ({ label: option, value: option }))
  return choices.find((choice) => choice.value === value)?.label ?? value
}

function ObjectMark({
  image,
  object,
  size = "sm",
}: {
  image: string
  object: ObjectType
  size?: "lg" | "sm"
}) {
  const Icon =
    object.display.icon === "building"
      ? Building2Icon
      : object.display.icon === "person" || object.display.icon === "party"
        ? UserRoundIcon
        : BoxIcon

  return (
    <span
      aria-hidden="true"
      className={
        size === "lg"
          ? "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-none border bg-background"
          : "flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-none border bg-background"
      }
    >
      {image.length > 0 ? (
        <img alt="" className="size-full object-cover" src={image} />
      ) : (
        <Icon className={size === "lg" ? "size-4" : "size-3"} />
      )}
    </span>
  )
}

export function ObjectTableIdentity({
  object,
  record,
  resolveImageSrc,
}: ObjectTableIdentityProps) {
  const title = displayText(record[object.display.title])
  const subtitle =
    object.display.subtitle === undefined
      ? ""
      : displayText(record[object.display.subtitle])
  const image =
    object.display.image === undefined
      ? ""
      : displayImage(record[object.display.image], resolveImageSrc)
  const status = displayStatus(object, record)
  const resolvedTitle = title.length > 0 ? title : `Untitled ${object.name}`

  return (
    <PreviewCard>
      <PreviewCardTrigger
        render={<span className="inline-flex min-w-0 items-center gap-1.5" />}
      >
        <ObjectMark image={image} object={object} />
        <span className="truncate font-medium">{resolvedTitle}</span>
      </PreviewCardTrigger>
      <PreviewCardContent>
        <div className="flex min-w-0 items-start gap-2.5">
          <ObjectMark image={image} object={object} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{resolvedTitle}</p>
            {subtitle.length > 0 ? (
              <p className="mt-0.5 truncate text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        {status.length > 0 ? (
          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2">
            <span className="text-muted-foreground">Status</span>
            <Badge variant="secondary" className="font-normal">
              {status}
            </Badge>
          </div>
        ) : null}
      </PreviewCardContent>
    </PreviewCard>
  )
}
