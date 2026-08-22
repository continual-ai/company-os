import { cn } from "@acme/ui/lib/utils"
import type { PropertyDefinition } from "@continual/runtime"
import {
  AtSignIcon,
  CalendarDaysIcon,
  CheckSquareIcon,
  CircleDollarSignIcon,
  FileIcon,
  Globe2Icon,
  HashIcon,
  ImageIcon,
  LinkIcon,
  ListIcon,
  PhoneIcon,
  TagsIcon,
  TextIcon,
} from "lucide-react"
import type { ComponentProps, ReactNode } from "react"

import { objectTablePropertySchema } from "./object-table-cell-types"

function ObjectTablePropertyIcon({
  property,
}: {
  property: PropertyDefinition
}) {
  const schema = objectTablePropertySchema(property)
  const iconProps = {
    "aria-hidden": true,
    className: "size-3 shrink-0",
  } as const

  if (schema.kind === "enum") return <TagsIcon {...iconProps} />
  if (schema.kind === "number") return <HashIcon {...iconProps} />
  if (schema.kind === "boolean") return <CheckSquareIcon {...iconProps} />
  if (schema.kind === "money") return <CircleDollarSignIcon {...iconProps} />
  if (schema.kind === "image") return <ImageIcon {...iconProps} />
  if (schema.kind === "file") return <FileIcon {...iconProps} />
  if (schema.kind === "recordId") return <LinkIcon {...iconProps} />
  if (schema.kind === "array") return <ListIcon {...iconProps} />

  if (schema.kind === "string") {
    if (schema.format === "domain" || schema.format === "url") {
      return <Globe2Icon {...iconProps} />
    }
    if (schema.format === "email") return <AtSignIcon {...iconProps} />
    if (schema.format === "phone") return <PhoneIcon {...iconProps} />
    if (schema.format === "date" || schema.format === "timestamp") {
      return <CalendarDaysIcon {...iconProps} />
    }
  }

  return <TextIcon {...iconProps} />
}

export function ObjectTableProperty({
  className,
  label,
  property,
  ...props
}: Omit<ComponentProps<"span">, "property"> & {
  label: ReactNode
  property: PropertyDefinition
}) {
  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-1.5", className)}
      {...props}
    >
      <ObjectTablePropertyIcon property={property} />
      <span className="truncate">{label}</span>
    </span>
  )
}
