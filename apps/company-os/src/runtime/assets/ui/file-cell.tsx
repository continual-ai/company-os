import { PaperclipIcon } from "lucide-react"

import { AssetPreviews } from "#/runtime/assets/ui/asset-preview.tsx"
import type { PropertyDefinition } from "#/runtime/model/index.ts"
import { Button } from "#/runtime/ui/components/button.tsx"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "#/runtime/ui/components/popover.tsx"
import { ObjectTableCellSurface } from "#/runtime/ui/model/object-table/object-table-cell-surface.tsx"
import { objectTablePropertySchema } from "#/runtime/ui/model/object-table/object-table-cell-types.ts"
import type { ObjectTableValue } from "#/runtime/ui/model/object-table/object-table-config.ts"

/** File metadata loads when the user opens the cell, never once per table row. */
export function FileCell({
  active,
  expandActive,
  property,
  value,
}: {
  readonly active: boolean
  readonly expandActive: boolean
  readonly property: PropertyDefinition
  readonly value: ObjectTableValue
}) {
  const values = Array.isArray(value) ? value : [value]
  const references = values.flatMap((item) =>
    typeof item === "object" &&
    item !== null &&
    "assetId" in item &&
    typeof item.assetId === "string"
      ? [
          {
            assetId: item.assetId,
            alt: "alt" in item && typeof item.alt === "string" ? item.alt : "",
          },
        ]
      : []
  )
  const schema = objectTablePropertySchema(property)
  const image =
    schema.kind === "array" &&
    objectTablePropertySchema(schema.items).kind === "image"
  return (
    <ObjectTableCellSurface active={active} expandActive={expandActive}>
      {references.length === 0 ? (
        <span className="text-muted-foreground/60">Empty</span>
      ) : (
        <Popover>
          <PopoverTrigger
            render={
              <Button size="sm" variant="ghost" className="h-6 px-1 text-xs" />
            }
          >
            <PaperclipIcon />
            {references.length} {references.length === 1 ? "file" : "files"}
          </PopoverTrigger>
          <PopoverContent align="start">
            <AssetPreviews references={references} image={image} />
          </PopoverContent>
        </Popover>
      )}
    </ObjectTableCellSurface>
  )
}
