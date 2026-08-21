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

export function ObjectTablePropertyIcon({
  property,
}: {
  property: PropertyDefinition
}) {
  if (property.kind === "enum") return <TagsIcon aria-hidden="true" />
  if (property.kind === "number") return <HashIcon aria-hidden="true" />
  if (property.kind === "boolean") return <CheckSquareIcon aria-hidden="true" />
  if (property.kind === "money") {
    return <CircleDollarSignIcon aria-hidden="true" />
  }
  if (property.kind === "image") return <ImageIcon aria-hidden="true" />
  if (property.kind === "file") return <FileIcon aria-hidden="true" />
  if (property.kind === "recordId") return <LinkIcon aria-hidden="true" />
  if (property.kind === "array") return <ListIcon aria-hidden="true" />

  if (property.kind === "string") {
    if (property.format === "domain" || property.format === "url") {
      return <Globe2Icon aria-hidden="true" />
    }
    if (property.format === "email") return <AtSignIcon aria-hidden="true" />
    if (property.format === "phone") return <PhoneIcon aria-hidden="true" />
    if (property.format === "date" || property.format === "timestamp") {
      return <CalendarDaysIcon aria-hidden="true" />
    }
  }

  return <TextIcon aria-hidden="true" />
}
