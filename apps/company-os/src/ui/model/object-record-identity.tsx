import type { ObjectType } from "@company/runtime"
import { Badge } from "@company/ui/components/badge"
import { Button } from "@company/ui/components/button"
import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from "@company/ui/components/preview-card"
import { cn } from "@company/ui/lib/utils"
import { Link } from "@tanstack/react-router"
import { XIcon } from "lucide-react"

import { assetContentUrl } from "#/modules/assets/asset/ui/upload.ts"
import type { ObjectRecordPresentation } from "#/ui/model/object-client.ts"
import { objectIcon } from "#/ui/model/object-icon.ts"
import { objectTablePropertySchema } from "#/ui/model/object-table/object-table-cell-types.ts"
import {
  objectTableImageValue,
  objectTableValueText,
  type ObjectTableImageResolver,
  type ObjectTableRecord,
  type ObjectTableValue,
} from "#/ui/model/object-table/object-table-config.ts"

interface ObjectRecordIdentityProps extends ObjectRecordPresentation {
  readonly expanded?: boolean | undefined
  readonly className?: string | undefined
  readonly href?: string | undefined
  readonly resolveImageSrc?: ObjectTableImageResolver | undefined
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
  return image === null
    ? ""
    : (resolveImageSrc?.(image) ?? assetContentUrl(image.assetId))
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

export function ObjectIcon({
  object,
  className,
}: {
  readonly object: ObjectType
  readonly className?: string | undefined
}) {
  const Icon = objectIcon(object.display.icon)

  return <Icon className={className} />
}

function ObjectMark({
  image,
  object,
  size = "sm",
}: {
  readonly image: string
  readonly object: ObjectType
  readonly size?: "lg" | "sm"
}) {
  return (
    <span
      aria-hidden="true"
      className={
        size === "lg"
          ? "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted/30"
          : "flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted/30"
      }
    >
      {image.length > 0 ? (
        <img alt="" className="size-full object-cover" src={image} />
      ) : (
        <ObjectIcon
          object={object}
          className={size === "lg" ? "size-4" : "size-3"}
        />
      )}
    </span>
  )
}

export function ObjectRecordIdentity({
  className,
  expanded = false,
  href,
  object,
  record,
  resolveImageSrc,
}: ObjectRecordIdentityProps) {
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
        render={
          href === undefined ? (
            <span
              className={cn(
                "inline-flex min-w-0 items-center gap-1.5",
                className
              )}
            />
          ) : (
            <Link
              to={href}
              data-record-id={record.id}
              className={cn(
                "inline-flex min-w-0 items-center gap-1.5 text-foreground underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none",
                className
              )}
              onClick={(event) => {
                event.stopPropagation()
              }}
              onDoubleClick={(event) => event.stopPropagation()}
            />
          )
        }
      >
        <ObjectMark image={image} object={object} />
        <span className="min-w-0">
          <span className="block truncate font-medium">{resolvedTitle}</span>
          {expanded && subtitle && (
            <span className="block truncate text-xs text-muted-foreground">
              {subtitle}
            </span>
          )}
        </span>
        {expanded && status && (
          <Badge variant="secondary" className="ml-auto shrink-0 font-normal">
            {status}
          </Badge>
        )}
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

export function ObjectRecordPill({
  label,
  onRemove,
  presentation,
}: {
  readonly label: string
  readonly onRemove?: (() => void) | undefined
  readonly presentation?: ObjectRecordPresentation | undefined
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1 rounded-sm border bg-muted py-1 pr-1 pl-1.5 text-xs">
      {presentation === undefined ? (
        <span className="max-w-56 truncate px-1">{label}</span>
      ) : (
        <ObjectRecordIdentity
          className="max-w-56"
          object={presentation.object}
          record={presentation.record}
        />
      )}
      {onRemove === undefined ? null : (
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
        >
          <XIcon />
        </Button>
      )}
    </span>
  )
}

export function ObjectRecordOption({
  label,
  presentation,
}: {
  readonly label: string
  readonly presentation?: ObjectRecordPresentation | undefined
}) {
  return presentation === undefined ? (
    <span className="truncate">{label}</span>
  ) : (
    <ObjectRecordIdentity
      className="max-w-full"
      object={presentation.object}
      record={presentation.record}
    />
  )
}
